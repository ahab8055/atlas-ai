/**
 * FileAccessService — product FS layer over injected os.files (ADR-0074 / 0082).
 */
import { createHash, randomBytes } from "node:crypto";
import { userInfo } from "node:os";
import path from "node:path";

import type { Logger } from "@atlas-ai/logging";
import {
  PlatformError,
  platformSecurityLog,
  type FileSystemService,
  type PathService,
} from "@atlas-ai/platform";
import type {
  PermissionCapability,
  PermissionManager,
} from "@atlas-ai/security";

import { mimeForEntry, mimeFromExtension } from "./mime.js";
import { decodeBytes, encodeBytes } from "./encoding.js";
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
  CreateDirectoryOptions,
  CreateDirectoryResult,
  CopyPathOptions,
  CopyPathResult,
  DeletePathOptions,
  DeletePathResult,
  MovePathOptions,
  MovePathResult,
  PathExistsResult,
  ReadFileOptions,
  RestorePathResult,
  WalkDirectoryOptions,
  WriteEncoding,
  WriteFileOptions,
  WriteFileResult,
  WriteMode,
} from "./types.js";

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_READ_BYTES = 256 * 1024;
const DEFAULT_LIMIT = 50;
const DEFAULT_MAX_CHECKSUM_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_ATOMIC_APPEND_BYTES = 16 * 1024 * 1024;

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
  /** Capability checks via PermissionManager (ADR-0082). */
  permissions?: PermissionManager;
  /** Optional security/application logger. */
  logger?: Logger;
}

function parentDir(filePath: string): string {
  return path.dirname(filePath);
}

function writeAtomic(
  files: FileSystemService,
  absolute: string,
  data: Uint8Array,
): void {
  const tmp = `${absolute}.${process.pid}.${Date.now()}.tmp`;
  try {
    files.writeBytes(tmp, data);
    files.rename(tmp, absolute);
  } catch (error) {
    try {
      if (files.exists(tmp)) {
        files.remove(tmp);
      }
    } catch {
      // best-effort cleanup
    }
    throw error;
  }
}

export function createFileAccessService(
  options: FileAccessServiceOptions,
): FileAccessService {
  const files = options.files;
  const permissions = options.permissions;
  const logger = options.logger;
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
      platformSecurityLog(logger, "warn", "FileAccess path denied", {
        operation: "assertAllowed",
        reason: "outside_roots",
        path: absolutePath,
      });
      throw new PlatformError(
        "permission_denied",
        `Path is outside allowed roots: ${absolutePath}`,
        { detail: { path: absolutePath } },
      );
    }
    if (matchesDeny(absolutePath, denyPatterns)) {
      platformSecurityLog(logger, "warn", "FileAccess path denied", {
        operation: "assertAllowed",
        reason: "deny_list",
        path: absolutePath,
      });
      throw new PlatformError(
        "permission_denied",
        `Access to sensitive path is denied: ${absolutePath}`,
        { detail: { path: absolutePath } },
      );
    }
  }

  function authorize(
    capability: PermissionCapability | readonly PermissionCapability[],
    operation: string,
    resource: string,
    privileged: boolean,
  ): void {
    if (!permissions) {
      return;
    }
    const caps = Array.isArray(capability) ? capability : [capability];
    for (const cap of caps) {
      const check = permissions.requestPermission({
        capability: cap,
        reason: operation,
        resource,
      });
      if (check.blocked) {
        platformSecurityLog(logger, "warn", "FileAccess permission denied", {
          operation,
          capability: cap,
          path: resource,
          decisionId: check.decisionId,
          approvalId: check.approval?.id,
        });
        throw new PlatformError(
          "permission_denied",
          check.evaluation.message ||
            `Permission denied for ${cap} (${operation})`,
          { approvalId: check.approval?.id, detail: { path: resource } },
        );
      }
    }
    if (privileged) {
      platformSecurityLog(
        logger,
        "info",
        "FileAccess privileged operation allowed",
        {
          operation,
          capability: caps.join(","),
          path: resource,
        },
      );
    }
  }

  function resolve(input: string): string {
    const absolute = resolveWithinRoots(input, roots, join);
    assertAllowed(absolute);
    return absolute;
  }

  function trashBase(): string {
    return path.join(roots[0]!, ".atlas", "trash");
  }

  function atlasMetaRoot(): string {
    return path.join(roots[0]!, ".atlas");
  }

  function isUnderAtlasMeta(absolutePath: string): boolean {
    const meta = atlasMetaRoot();
    const prefix = meta.endsWith(path.sep) ? meta : `${meta}${path.sep}`;
    return absolutePath === meta || absolutePath.startsWith(prefix);
  }

  /** Inside roots, skip deny (for trash internals). */
  function assertInsideRoots(absolutePath: string): void {
    if (!isPathInsideRoots(absolutePath, roots)) {
      throw new PlatformError(
        "permission_denied",
        `Path is outside allowed roots: ${absolutePath}`,
        { detail: { path: absolutePath } },
      );
    }
  }

  function ensureDestClear(to: string, overwrite: boolean): boolean {
    if (!files.exists(to)) {
      return false;
    }
    const toStat = files.stat(to);
    if (!overwrite) {
      throw new PlatformError(
        "invalid_input",
        `Destination already exists: ${to}`,
        { detail: { path: to } },
      );
    }
    if (toStat.isDirectory) {
      const children = files.listDir(to);
      if (children.length > 0) {
        throw new PlatformError(
          "invalid_input",
          `Destination directory is not empty: ${to}`,
          { detail: { path: to } },
        );
      }
    }
    files.remove(to);
    return true;
  }

  function ensureParent(to: string, createDirs: boolean): void {
    const parent = parentDir(to);
    if (parent && parent !== to && !files.exists(parent)) {
      if (!createDirs) {
        throw new PlatformError(
          "invalid_input",
          `Parent directory does not exist: ${parent}`,
          { detail: { path: parent } },
        );
      }
      files.mkdirp(parent);
    }
  }

  function rejectSelfNest(from: string, to: string, kind: string): void {
    if (kind !== "directory") {
      return;
    }
    const fromPrefix = from.endsWith(path.sep) ? from : `${from}${path.sep}`;
    if (to === from || to.startsWith(fromPrefix)) {
      throw new PlatformError(
        "invalid_input",
        `Cannot place a directory inside itself: ${from} → ${to}`,
        { detail: { path: from } },
      );
    }
  }

  function copyTree(from: string, to: string): void {
    files.mkdirp(to);
    for (const name of files.listDir(from)) {
      const src = path.join(from, name);
      const dest = path.join(to, name);
      const st = files.lstat(src);
      if (st.isDirectory && !st.isSymbolicLink) {
        copyTree(src, dest);
      } else if (st.isFile && !st.isSymbolicLink) {
        files.copyFile(src, dest);
      }
      // skip symlinks in MVP copy
    }
  }

  interface TrashManifest {
    originalPath: string;
    kind: "file" | "directory";
    deletedAtMs: number;
    payloadName: string;
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
      authorize("filesystem.read", "resolvePath", inputPath, false);
      return resolve(inputPath);
    },

    listDirectory(
      inputPath?: string,
      opts: ListDirectoryOptions = {},
    ): DirEntry[] {
      authorize(
        "filesystem.read",
        "listDirectory",
        inputPath ?? roots[0]!,
        false,
      );
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
      authorize(
        "filesystem.read",
        "walkDirectory",
        inputPath ?? roots[0]!,
        false,
      );
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
      authorize("filesystem.read", "findFiles", query.root ?? roots[0]!, false);
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
      authorize("filesystem.read", "readFile", inputPath, false);
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
    ): WriteFileResult {
      authorize("filesystem.write", "writeFile", inputPath, true);
      const absolute = resolve(inputPath);
      const createDirs = opts.createDirs !== false;
      const encoding: WriteEncoding = opts.encoding ?? "utf-8";
      const mode: WriteMode =
        opts.mode ?? (opts.overwrite === false ? "create" : "overwrite");
      const useAtomic =
        opts.atomic !== undefined ? opts.atomic : mode !== "append";

      const existed = files.exists(absolute);
      if (existed) {
        const st = files.stat(absolute);
        if (st.isDirectory) {
          throw new PlatformError(
            "invalid_input",
            `Cannot write file over a directory: ${absolute}`,
            { detail: { path: absolute } },
          );
        }
        if (mode === "create") {
          throw new PlatformError(
            "invalid_input",
            `File already exists: ${absolute}`,
            { detail: { path: absolute } },
          );
        }
      }

      const parent = parentDir(absolute);
      if (parent && parent !== absolute && !files.exists(parent)) {
        if (!createDirs) {
          throw new PlatformError(
            "invalid_input",
            `Parent directory does not exist: ${parent}`,
            { detail: { path: parent } },
          );
        }
        files.mkdirp(parent);
      }

      const payload = encodeBytes(content, {
        encoding,
        bom: opts.bom,
      });

      if (mode === "append") {
        if (useAtomic) {
          const existing = existed
            ? files.readBytes(absolute)
            : new Uint8Array(0);
          if (existing.length > DEFAULT_MAX_ATOMIC_APPEND_BYTES) {
            throw new PlatformError(
              "invalid_input",
              `Atomic append rejected: file exceeds ${DEFAULT_MAX_ATOMIC_APPEND_BYTES} bytes: ${absolute}`,
              { detail: { path: absolute } },
            );
          }
          const merged = new Uint8Array(existing.length + payload.length);
          merged.set(existing, 0);
          merged.set(payload, existing.length);
          writeAtomic(files, absolute, merged);
        } else {
          files.appendBytes(absolute, payload);
        }
        return {
          path: absolute,
          bytesWritten: payload.length,
          encoding,
          mode,
          atomic: useAtomic,
          created: !existed,
        };
      }

      if (useAtomic) {
        writeAtomic(files, absolute, payload);
      } else {
        files.writeBytes(absolute, payload);
      }

      return {
        path: absolute,
        bytesWritten: payload.length,
        encoding,
        mode,
        atomic: useAtomic,
        created: !existed,
      };
    },

    createDirectory(
      inputPath: string,
      opts: CreateDirectoryOptions = {},
    ): CreateDirectoryResult {
      authorize("filesystem.write", "createDirectory", inputPath, true);
      const absolute = resolve(inputPath);
      const recursive = opts.recursive !== false;

      if (files.exists(absolute)) {
        const st = files.stat(absolute);
        if (st.isDirectory) {
          return { path: absolute, created: false };
        }
        throw new PlatformError(
          "invalid_input",
          `Path exists and is not a directory: ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      if (!recursive) {
        const parent = parentDir(absolute);
        if (parent && parent !== absolute && !files.exists(parent)) {
          throw new PlatformError(
            "invalid_input",
            `Parent directory does not exist: ${parent}`,
            { detail: { path: parent } },
          );
        }
      }

      files.mkdirp(absolute);
      return { path: absolute, created: true };
    },

    deleteFile(inputPath: string): DeletePathResult {
      return this.deletePath(inputPath, { trash: false, recursive: true });
    },

    deleteDirectory(inputPath: string): void {
      authorize("filesystem.delete", "deleteDirectory", inputPath, true);
      const absolute = resolve(inputPath);
      if (!files.exists(absolute)) {
        throw new PlatformError(
          "resource_not_found",
          `Path not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const st = files.stat(absolute);
      if (!st.isDirectory) {
        throw new PlatformError(
          "invalid_input",
          `Not a directory: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const children = files.listDir(absolute);
      if (children.length > 0) {
        throw new PlatformError(
          "invalid_input",
          `Directory is not empty: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      files.remove(absolute);
    },

    deletePath(
      inputPath: string,
      opts: DeletePathOptions = {},
    ): DeletePathResult {
      authorize("filesystem.delete", "deletePath", inputPath, true);
      const absolute = resolve(inputPath);
      if (!files.exists(absolute)) {
        throw new PlatformError(
          "resource_not_found",
          `Path not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      if (isUnderAtlasMeta(absolute)) {
        throw new PlatformError(
          "invalid_input",
          `Cannot delete Atlas metadata path: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const st = files.stat(absolute);
      const kind: "file" | "directory" = st.isDirectory ? "directory" : "file";
      const useTrash = opts.trash !== false;
      const recursive = opts.recursive !== false;

      if (kind === "directory" && !useTrash && !recursive) {
        const children = files.listDir(absolute);
        if (children.length > 0) {
          throw new PlatformError(
            "invalid_input",
            `Directory is not empty: ${absolute}`,
            { detail: { path: absolute } },
          );
        }
      }

      if (!useTrash) {
        files.remove(absolute);
        return {
          path: absolute,
          kind,
          mode: "hard",
          restorable: false,
        };
      }

      const trashId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
      const entryDir = path.join(trashBase(), trashId);
      const payloadDir = path.join(entryDir, "payload");
      assertInsideRoots(entryDir);
      files.mkdirp(payloadDir);
      const payloadName = path.basename(absolute);
      const payloadPath = path.join(payloadDir, payloadName);
      files.rename(absolute, payloadPath);
      const manifest: TrashManifest = {
        originalPath: absolute,
        kind,
        deletedAtMs: Date.now(),
        payloadName,
      };
      files.writeText(
        path.join(entryDir, "manifest.json"),
        `${JSON.stringify(manifest)}\n`,
      );
      return {
        path: absolute,
        kind,
        mode: "trash",
        trashId,
        restorable: true,
      };
    },

    restorePath(trashId: string): RestorePathResult {
      authorize(
        ["filesystem.write", "filesystem.delete"],
        "restorePath",
        trashId,
        true,
      );
      const id = trashId.trim();
      if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) {
        throw new PlatformError(
          "invalid_input",
          `Invalid trash id: ${trashId}`,
        );
      }
      const entryDir = path.join(trashBase(), id);
      assertInsideRoots(entryDir);
      const manifestPath = path.join(entryDir, "manifest.json");
      if (!files.exists(manifestPath)) {
        throw new PlatformError(
          "resource_not_found",
          `Trash entry not found: ${id}`,
          { detail: { path: entryDir } },
        );
      }
      let manifest: TrashManifest;
      try {
        manifest = JSON.parse(files.readText(manifestPath)) as TrashManifest;
      } catch (error) {
        throw new PlatformError(
          "invalid_input",
          `Corrupt trash manifest: ${id}`,
          {
            detail: { path: manifestPath },
            cause: error,
          },
        );
      }
      assertAllowed(manifest.originalPath);
      if (files.exists(manifest.originalPath)) {
        throw new PlatformError(
          "invalid_input",
          `Restore target already exists: ${manifest.originalPath}`,
          { detail: { path: manifest.originalPath } },
        );
      }
      const payloadPath = path.join(entryDir, "payload", manifest.payloadName);
      if (!files.exists(payloadPath)) {
        throw new PlatformError(
          "resource_not_found",
          `Trash payload missing: ${id}`,
          { detail: { path: payloadPath } },
        );
      }
      ensureParent(manifest.originalPath, true);
      files.rename(payloadPath, manifest.originalPath);
      files.remove(entryDir);
      return {
        trashId: id,
        path: manifest.originalPath,
        kind: manifest.kind,
      };
    },

    copyPath(
      fromInput: string,
      toInput: string,
      opts: CopyPathOptions = {},
    ): CopyPathResult {
      authorize(
        "filesystem.write",
        "copyPath",
        `${fromInput}→${toInput}`,
        true,
      );
      const from = resolve(fromInput);
      const to = resolve(toInput);
      const createDirs = opts.createDirs !== false;
      const overwrite = opts.overwrite === true;
      const recursive = opts.recursive !== false;

      if (!files.exists(from)) {
        throw new PlatformError(
          "resource_not_found",
          `Source not found: ${from}`,
          { detail: { path: from } },
        );
      }
      const fromStat = files.stat(from);
      const kind: "file" | "directory" = fromStat.isDirectory
        ? "directory"
        : "file";
      rejectSelfNest(from, to, kind);

      if (kind === "directory" && !recursive) {
        throw new PlatformError(
          "invalid_input",
          `Directory copy requires recursive: true: ${from}`,
          { detail: { path: from } },
        );
      }

      const overwritten = ensureDestClear(to, overwrite);
      ensureParent(to, createDirs);

      if (kind === "file") {
        files.copyFile(from, to);
        return {
          from,
          to,
          kind,
          bytesCopied: fromStat.size,
          overwritten,
        };
      }

      copyTree(from, to);
      return { from, to, kind, overwritten };
    },

    movePath(
      fromInput: string,
      toInput: string,
      opts: MovePathOptions = {},
    ): MovePathResult {
      authorize(
        ["filesystem.write", "filesystem.delete"],
        "movePath",
        `${fromInput}→${toInput}`,
        true,
      );
      const from = resolve(fromInput);
      const to = resolve(toInput);
      const createDirs = opts.createDirs !== false;
      const overwrite = opts.overwrite === true;

      if (!files.exists(from)) {
        throw new PlatformError(
          "resource_not_found",
          `Source not found: ${from}`,
          { detail: { path: from } },
        );
      }

      const fromStat = files.stat(from);
      const kind: "file" | "directory" = fromStat.isDirectory
        ? "directory"
        : "file";

      if (from === to) {
        return { from, to, kind };
      }

      rejectSelfNest(from, to, kind);
      ensureDestClear(to, overwrite);
      ensureParent(to, createDirs);
      files.rename(from, to);
      return { from, to, kind };
    },

    renamePath(
      fromInput: string,
      toInput: string,
      opts?: MovePathOptions,
    ): MovePathResult {
      return this.movePath(fromInput, toInput, opts);
    },

    moveFile(
      fromInput: string,
      toInput: string,
      opts?: MovePathOptions,
    ): MovePathResult {
      return this.movePath(fromInput, toInput, opts);
    },

    directoryExists(inputPath: string): boolean {
      authorize("filesystem.read", "directoryExists", inputPath, false);
      try {
        const absolute = resolve(inputPath);
        if (!files.exists(absolute)) {
          return false;
        }
        return files.stat(absolute).isDirectory;
      } catch {
        return false;
      }
    },

    pathExists(inputPath: string): PathExistsResult {
      authorize("filesystem.read", "pathExists", inputPath, false);
      try {
        const absolute = resolve(inputPath);
        if (!files.exists(absolute)) {
          return { exists: false, isFile: false, isDirectory: false };
        }
        const st = files.stat(absolute);
        return {
          exists: true,
          isFile: st.isFile,
          isDirectory: st.isDirectory,
        };
      } catch {
        return { exists: false, isFile: false, isDirectory: false };
      }
    },

    getFileMetadata(
      inputPath: string,
      opts: GetFileMetadataOptions = {},
    ): FileMetadata {
      authorize("filesystem.read", "getFileMetadata", inputPath, false);
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
