/**
 * FileAccessService — product FS layer over injected os.files (ADR-0074).
 */
import { createHash } from "node:crypto";
import { userInfo } from "node:os";
import path from "node:path";

import {
  PlatformError,
  type FileSystemService,
  type PathService,
} from "@atlas-ai/platform";

import { mimeForEntry, mimeFromExtension } from "./mime.js";
import { decodeBytes } from "./encoding.js";
import { formatFromExtension, isUnsupportedBinaryFormat } from "./format.js";
import { parseCsvSafe } from "./parsers/csv.js";
import { parseJsonSafe } from "./parsers/json.js";
import { parseYamlLite } from "./parsers/yaml-lite.js";
import {
  DEFAULT_DENY_PATTERNS,
  fileExtension,
  isPathInsideRoots,
  matchesDeny,
  normalizeExtensions,
  patternToRegExp,
  resolveWithinRoots,
} from "./paths.js";
import { modeToPermissions } from "./permissions-format.js";
import type {
  FileAccessService,
  FileContent,
  FileHit,
  FileMetadata,
  FileSearchResult,
  FindFilesQuery,
  GetFileMetadataOptions,
  ListDirectoryOptions,
  DirEntry,
  ReadFileOptions,
  WalkDirectoryOptions,
  WriteFileOptions,
} from "./types.js";

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_READ_BYTES = 256 * 1024;
const DEFAULT_LIMIT = 50;
const DEFAULT_MAX_CHECKSUM_BYTES = 16 * 1024 * 1024;

export interface FileAccessServiceOptions {
  files: FileSystemService;
  paths?: PathService;
  /** Absolute roots; relative tool paths resolve against roots[0]. */
  roots?: string[];
  maxDepth?: number;
  maxReadBytes?: number;
  denyPatterns?: RegExp[];
  /** Max search hits (overridable per findFiles call). */
  defaultLimit?: number;
}

function parentDir(filePath: string): string {
  return path.dirname(filePath);
}

export function createFileAccessService(
  options: FileAccessServiceOptions,
): FileAccessService {
  const files = options.files;
  const join =
    options.paths?.join.bind(options.paths) ??
    ((...parts: string[]) => path.join(...parts));
  const cwd = options.paths?.cwd() ?? path.resolve(".");
  const roots = (options.roots?.length ? options.roots : [cwd]).map((r) =>
    path.resolve(r),
  );
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxReadBytes = options.maxReadBytes ?? DEFAULT_MAX_READ_BYTES;
  const denyPatterns = options.denyPatterns ?? [...DEFAULT_DENY_PATTERNS];
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;

  function assertAllowed(absolutePath: string): void {
    if (!isPathInsideRoots(absolutePath, roots)) {
      throw new PlatformError(
        "permission_denied",
        `Path is outside allowed roots: ${absolutePath}`,
        { detail: { path: absolutePath } },
      );
    }
    if (matchesDeny(absolutePath, denyPatterns)) {
      throw new PlatformError(
        "permission_denied",
        `Access to sensitive path is denied: ${absolutePath}`,
        { detail: { path: absolutePath } },
      );
    }
  }

  function resolve(input: string): string {
    const absolute = resolveWithinRoots(input, roots, join);
    assertAllowed(absolute);
    return absolute;
  }

  function toDirEntry(full: string, name: string): DirEntry | undefined {
    try {
      const st = files.lstat(full);
      const entry: DirEntry = {
        path: full,
        name,
        isFile: st.isFile,
        isDirectory: st.isDirectory,
        isSymbolicLink: st.isSymbolicLink,
        size: st.size,
        mtimeMs: st.mtimeMs,
      };
      if (st.isSymbolicLink) {
        try {
          entry.linkTarget = files.readlink(full);
        } catch {
          // dangling / unreadable link
        }
      }
      return entry;
    } catch {
      return undefined;
    }
  }

  function isHiddenName(name: string): boolean {
    return name.startsWith(".");
  }

  function resolveSymlinkTarget(linkPath: string, linkTarget: string): string {
    if (path.isAbsolute(linkTarget)) {
      return path.resolve(linkTarget);
    }
    return path.resolve(path.dirname(linkPath), linkTarget);
  }

  return {
    resolvePath(inputPath: string): string {
      return resolve(inputPath);
    },

    listDirectory(
      inputPath?: string,
      opts: ListDirectoryOptions = {},
    ): DirEntry[] {
      const absolute = inputPath !== undefined ? resolve(inputPath) : roots[0]!;
      assertAllowed(absolute);
      if (!files.exists(absolute)) {
        throw new PlatformError(
          "resource_not_found",
          `Directory not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const st = files.lstat(absolute);
      if (st.isSymbolicLink) {
        // Listing a symlink path: follow for "is this a dir?" via stat
        const followed = files.stat(absolute);
        if (!followed.isDirectory) {
          throw new PlatformError(
            "invalid_input",
            `Not a directory: ${absolute}`,
            { detail: { path: absolute } },
          );
        }
      } else if (!st.isDirectory) {
        throw new PlatformError(
          "invalid_input",
          `Not a directory: ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      const includeHidden = opts.includeHidden === true;
      const out: DirEntry[] = [];
      for (const name of files.listDir(absolute)) {
        if (!includeHidden && isHiddenName(name)) {
          continue;
        }
        const full = join(absolute, name);
        if (
          matchesDeny(full, denyPatterns) ||
          !isPathInsideRoots(full, roots)
        ) {
          continue;
        }
        const entry = toDirEntry(full, name);
        if (entry) {
          out.push(entry);
        }
      }
      return out;
    },

    walkDirectory(
      inputPath?: string,
      opts: WalkDirectoryOptions = {},
    ): DirEntry[] {
      const absolute = inputPath !== undefined ? resolve(inputPath) : roots[0]!;
      assertAllowed(absolute);
      const walkMaxDepth = opts.maxDepth ?? maxDepth;
      const followSymlinks = opts.followSymlinks === true;
      const includeHidden = opts.includeHidden === true;
      const limit = opts.limit ?? defaultLimit;
      const out: DirEntry[] = [];
      const visited = new Set<string>();

      const visit = (dir: string, depth: number): void => {
        if (out.length >= limit || depth > walkMaxDepth) {
          return;
        }
        if (visited.has(dir)) {
          return;
        }
        visited.add(dir);

        let names: string[];
        try {
          names = files.listDir(dir);
        } catch {
          return;
        }

        for (const name of names) {
          if (out.length >= limit) {
            return;
          }
          if (!includeHidden && isHiddenName(name)) {
            continue;
          }
          const full = join(dir, name);
          if (
            matchesDeny(full, denyPatterns) ||
            !isPathInsideRoots(full, roots)
          ) {
            continue;
          }
          const entry = toDirEntry(full, name);
          if (!entry) {
            continue;
          }
          out.push(entry);

          let descend = entry.isDirectory && !entry.isSymbolicLink;
          if (entry.isSymbolicLink && followSymlinks && entry.linkTarget) {
            const target = resolveSymlinkTarget(full, entry.linkTarget);
            if (
              isPathInsideRoots(target, roots) &&
              !matchesDeny(target, denyPatterns) &&
              !visited.has(target)
            ) {
              try {
                const tst = files.stat(target);
                if (tst.isDirectory) {
                  visit(target, depth + 1);
                }
              } catch {
                // skip broken
              }
            }
            descend = false;
          }

          if (descend) {
            visit(full, depth + 1);
          }
        }
      };

      if (!files.exists(absolute)) {
        throw new PlatformError(
          "resource_not_found",
          `Directory not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      let startDir = absolute;
      try {
        const rootLstat = files.lstat(absolute);
        if (rootLstat.isSymbolicLink && followSymlinks) {
          const target = resolveSymlinkTarget(
            absolute,
            files.readlink(absolute),
          );
          assertAllowed(target);
          startDir = target;
        } else if (!rootLstat.isDirectory && !rootLstat.isSymbolicLink) {
          throw new PlatformError(
            "invalid_input",
            `Not a directory: ${absolute}`,
            { detail: { path: absolute } },
          );
        } else if (rootLstat.isSymbolicLink && !followSymlinks) {
          const followed = files.stat(absolute);
          if (!followed.isDirectory) {
            throw new PlatformError(
              "invalid_input",
              `Not a directory: ${absolute}`,
              { detail: { path: absolute } },
            );
          }
          // Without followSymlinks, still list through the link path as dir
        } else if (!rootLstat.isDirectory) {
          throw new PlatformError(
            "invalid_input",
            `Not a directory: ${absolute}`,
            { detail: { path: absolute } },
          );
        }
      } catch (error) {
        if (error instanceof PlatformError) {
          throw error;
        }
        throw new PlatformError(
          "io_error",
          `Cannot walk directory: ${absolute}`,
          { detail: { path: absolute }, cause: error },
        );
      }

      visit(startDir, 0);
      return out;
    },

    findFiles(query: FindFilesQuery): FileSearchResult {
      const started = Date.now();
      const pattern = query.pattern?.trim() ?? "";
      const matcher = patternToRegExp(pattern);
      const limit = query.limit ?? defaultLimit;
      const searchMaxDepth = query.maxDepth ?? maxDepth;
      const includeHidden = query.includeHidden === true;
      const filesOnly = query.filesOnly !== false;
      const extensions = normalizeExtensions(query.extensions);
      const searchRoot = query.root ? resolve(query.root) : roots[0]!;
      assertAllowed(searchRoot);

      if (!files.exists(searchRoot)) {
        throw new PlatformError(
          "resource_not_found",
          `Search root does not exist: ${searchRoot}`,
          { detail: { path: searchRoot } },
        );
      }

      const hits: FileHit[] = [];
      let scannedEntries = 0;
      let truncated = false;

      const extensionOk = (name: string): boolean => {
        if (!extensions) {
          return true;
        }
        const ext = fileExtension(name);
        return extensions.includes(ext);
      };

      const pushHit = (
        full: string,
        name: string,
        meta: {
          isFile: boolean;
          isDirectory: boolean;
          isSymbolicLink: boolean;
          size?: number;
          mtimeMs?: number;
          match: "name" | "content";
        },
      ): void => {
        if (filesOnly && meta.isDirectory) {
          return;
        }
        if (!meta.isDirectory && !extensionOk(name)) {
          return;
        }
        if (meta.isDirectory && extensions) {
          // Directory hits ignored when extension filter is active
          return;
        }
        hits.push({
          path: full,
          name,
          match: meta.match,
          isFile: meta.isFile,
          isDirectory: meta.isDirectory,
          isSymbolicLink: meta.isSymbolicLink,
          size: meta.size,
          mtimeMs: meta.mtimeMs,
          extension: meta.isDirectory ? undefined : fileExtension(name),
        });
        if (hits.length >= limit) {
          truncated = true;
        }
      };

      const visit = (dir: string, depth: number): void => {
        if (truncated || depth > searchMaxDepth) {
          return;
        }
        let names: string[];
        try {
          names = files.listDir(dir);
        } catch {
          return;
        }
        for (const name of names) {
          if (truncated) {
            return;
          }
          if (!includeHidden && name.startsWith(".")) {
            continue;
          }
          const full = join(dir, name);
          if (matchesDeny(full, denyPatterns)) {
            continue;
          }
          if (!isPathInsideRoots(full, roots)) {
            continue;
          }

          scannedEntries += 1;

          let isDirectory = false;
          let isFile = false;
          let isSymbolicLink = false;
          let size: number | undefined;
          let mtimeMs: number | undefined;
          try {
            const st = files.lstat(full);
            isSymbolicLink = st.isSymbolicLink;
            isDirectory = st.isDirectory;
            isFile = st.isFile;
            size = st.size;
            mtimeMs = st.mtimeMs;
            // Symlink to dir: treat as non-descendable (do not follow)
            if (isSymbolicLink) {
              isDirectory = false;
              // Keep isFile false for bare links unless we want to match link names
            }
          } catch {
            continue;
          }

          const nameMatched = matcher.test(name);
          if (nameMatched) {
            pushHit(full, name, {
              isFile,
              isDirectory,
              isSymbolicLink,
              size,
              mtimeMs,
              match: "name",
            });
          } else if (
            query.content &&
            isFile &&
            !isSymbolicLink &&
            extensionOk(name) &&
            size !== undefined &&
            size <= maxReadBytes
          ) {
            try {
              const text = files.readText(full);
              if (
                matcher.test(text) ||
                text.toLowerCase().includes(pattern.toLowerCase())
              ) {
                pushHit(full, name, {
                  isFile: true,
                  isDirectory: false,
                  isSymbolicLink: false,
                  size,
                  mtimeMs,
                  match: "content",
                });
              }
            } catch {
              // skip unreadable
            }
          }

          if (isDirectory && !isSymbolicLink && !truncated) {
            visit(full, depth + 1);
          }
        }
      };

      try {
        const rootLstat = files.lstat(searchRoot);
        if (
          rootLstat.isFile ||
          (rootLstat.isSymbolicLink && !rootLstat.isDirectory)
        ) {
          scannedEntries += 1;
          const name = path.basename(searchRoot);
          if (matcher.test(name)) {
            pushHit(searchRoot, name, {
              isFile: rootLstat.isFile || rootLstat.isSymbolicLink,
              isDirectory: false,
              isSymbolicLink: rootLstat.isSymbolicLink,
              size: rootLstat.size,
              mtimeMs: rootLstat.mtimeMs,
              match: "name",
            });
          }
          return {
            hits,
            truncated,
            scannedEntries,
            durationMs: Date.now() - started,
          };
        }
      } catch {
        // fall through to directory walk
      }

      visit(searchRoot, 0);
      return {
        hits,
        truncated,
        scannedEntries,
        durationMs: Date.now() - started,
      };
    },

    readFile(inputPath: string, opts: ReadFileOptions = {}): FileContent {
      const absolute = resolve(inputPath);
      if (!files.exists(absolute)) {
        throw new PlatformError(
          "resource_not_found",
          `File not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const st = files.stat(absolute);
      if (st.isDirectory) {
        throw new PlatformError(
          "invalid_input",
          `Cannot read a directory as a file: ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      const name = path.basename(absolute);
      const extension = fileExtension(name);
      const mimeType = mimeFromExtension(extension);
      const format = formatFromExtension(extension);

      if (isUnsupportedBinaryFormat(format)) {
        throw new PlatformError(
          "invalid_input",
          `Unsupported binary file type (${mimeType}): ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      const offset = opts.offset ?? 0;
      const window = opts.maxBytes ?? maxReadBytes;
      const doParse = opts.parse !== false;

      if (!Number.isFinite(offset) || offset < 0) {
        throw new PlatformError(
          "invalid_input",
          `Invalid read offset: ${offset}`,
          { detail: { path: absolute } },
        );
      }
      if (!Number.isFinite(window) || window < 0) {
        throw new PlatformError(
          "invalid_input",
          `Invalid maxBytes: ${window}`,
          { detail: { path: absolute } },
        );
      }

      const bytes = files.readBytes(absolute, {
        offset,
        length: window,
      });
      const truncated = st.size > offset + bytes.length;
      const decoded = decodeBytes(bytes);

      if (decoded.binaryLike) {
        throw new PlatformError(
          "invalid_input",
          `File content appears binary (encoding=${decoded.encoding}): ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      const result: FileContent = {
        path: absolute,
        content: decoded.text,
        size: st.size,
        format,
        mimeType,
        encoding: decoded.encoding,
        byteOffset: offset,
        byteLength: bytes.length,
        truncated,
      };

      if (doParse && !truncated) {
        if (format === "json") {
          const parsed = parseJsonSafe(decoded.text);
          if (parsed.data !== undefined) {
            result.data = parsed.data;
          }
          if (parsed.parseError) {
            result.parseError = parsed.parseError;
          }
        } else if (format === "yaml") {
          const parsed = parseYamlLite(decoded.text);
          if (parsed.data !== undefined) {
            result.data = parsed.data;
          }
          if (parsed.parseError) {
            result.parseError = parsed.parseError;
          }
        } else if (format === "csv") {
          const parsed = parseCsvSafe(decoded.text);
          if (parsed.data !== undefined) {
            result.data = parsed.data;
          }
          if (parsed.parseError) {
            result.parseError = parsed.parseError;
          }
        }
      } else if (doParse && truncated) {
        result.parseError = "parse skipped: content truncated";
      }

      return result;
    },

    writeFile(
      inputPath: string,
      content: string,
      opts: WriteFileOptions = {},
    ): void {
      const absolute = resolve(inputPath);
      const createDirs = opts.createDirs !== false;
      const overwrite = opts.overwrite !== false;

      if (files.exists(absolute)) {
        const st = files.stat(absolute);
        if (st.isDirectory) {
          throw new PlatformError(
            "invalid_input",
            `Cannot write file over a directory: ${absolute}`,
            { detail: { path: absolute } },
          );
        }
        if (!overwrite) {
          throw new PlatformError(
            "invalid_input",
            `File already exists: ${absolute}`,
            { detail: { path: absolute } },
          );
        }
      }

      if (createDirs) {
        const parent = parentDir(absolute);
        if (parent && parent !== absolute && !files.exists(parent)) {
          files.mkdirp(parent);
        }
      }

      files.writeText(absolute, content);
    },

    createDirectory(inputPath: string): void {
      const absolute = resolve(inputPath);
      files.mkdirp(absolute);
    },

    deleteFile(inputPath: string): void {
      const absolute = resolve(inputPath);
      if (!files.exists(absolute)) {
        throw new PlatformError(
          "resource_not_found",
          `Path not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      files.remove(absolute);
    },

    moveFile(fromInput: string, toInput: string): void {
      const from = resolve(fromInput);
      const to = resolve(toInput);
      if (!files.exists(from)) {
        throw new PlatformError(
          "resource_not_found",
          `Source not found: ${from}`,
          { detail: { path: from } },
        );
      }
      const st = files.stat(from);
      if (st.isDirectory) {
        throw new PlatformError(
          "not_implemented",
          "Moving directories is not supported in MVP FileAccessService",
          { detail: { path: from } },
        );
      }
      const content = files.readText(from);
      const parent = parentDir(to);
      if (parent && !files.exists(parent)) {
        files.mkdirp(parent);
      }
      files.writeText(to, content);
      files.remove(from);
    },

    getFileMetadata(
      inputPath: string,
      opts: GetFileMetadataOptions = {},
    ): FileMetadata {
      const absolute = resolve(inputPath);
      if (!files.exists(absolute)) {
        throw new PlatformError(
          "resource_not_found",
          `Path not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      const followSymlinks = opts.followSymlinks !== false;
      const includeChecksum = opts.includeChecksum !== false;
      const maxChecksumBytes =
        opts.maxChecksumBytes ?? DEFAULT_MAX_CHECKSUM_BYTES;

      const st = followSymlinks ? files.stat(absolute) : files.lstat(absolute);
      const name = path.basename(absolute);
      const extension = st.isDirectory ? "" : fileExtension(name);

      let ownerName: string | undefined;
      try {
        const getuid = (process as NodeJS.Process & { getuid?: () => number })
          .getuid;
        if (typeof getuid === "function" && getuid() === st.uid) {
          ownerName = userInfo().username;
        }
      } catch {
        // ignore userInfo failures
      }

      const meta: FileMetadata = {
        path: absolute,
        name,
        extension,
        size: st.size,
        isFile: st.isFile,
        isDirectory: st.isDirectory,
        isSymbolicLink: st.isSymbolicLink,
        createdAtMs: st.birthtimeMs,
        modifiedAtMs: st.mtimeMs,
        mode: st.mode,
        permissions: modeToPermissions(st.mode),
        owner: {
          uid: st.uid,
          gid: st.gid,
          ...(ownerName !== undefined ? { name: ownerName } : {}),
        },
        mimeType: mimeForEntry({
          isDirectory: st.isDirectory,
          isSymbolicLink: st.isSymbolicLink,
          extension,
        }),
      };

      if (!includeChecksum) {
        meta.checksumSkipped = "checksum disabled";
        return meta;
      }
      if (!st.isFile || st.isDirectory || st.isSymbolicLink) {
        meta.checksumSkipped = "not a regular file";
        return meta;
      }
      if (st.size > maxChecksumBytes) {
        meta.checksumSkipped = `file exceeds maxChecksumBytes (${maxChecksumBytes})`;
        return meta;
      }

      try {
        const bytes = files.readBytes(absolute);
        meta.checksum = {
          algorithm: "sha256",
          hex: createHash("sha256").update(bytes).digest("hex"),
        };
      } catch (error) {
        meta.checksumSkipped =
          error instanceof Error ? error.message : "checksum failed";
      }

      return meta;
    },
  };
}
