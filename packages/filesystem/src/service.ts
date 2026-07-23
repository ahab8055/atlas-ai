/**
 * FileAccessService — product FS layer over injected os.files (ADR-0074 / 0082).
 */
import { createHash, randomBytes } from "node:crypto";
import { userInfo } from "node:os";
import path from "node:path";

import type { Logger } from "@atlas-ai/logging";
import {
  isPlatformError,
  platformSecurityLog,
  type FileSystemService,
  type PathService,
} from "@atlas-ai/platform";
import type {
  PermissionCapability,
  PermissionManager,
} from "@atlas-ai/security";

import { createIgnoreRulesEngine, type IgnoreRulesEngine } from "./ignore.js";
import { createFileSystemError, fromPlatformErrorForFs } from "./errors.js";
import { mimeForEntry } from "./mime.js";
import { decodeBytes, encodeBytes } from "./encoding.js";
import {
  DEFAULT_DETECT_BYTES,
  detectFileType as detectFileTypeFromBytes,
} from "./detect.js";
import { isUnsupportedBinaryFormat } from "./format.js";
import { isIndexableFormat, processorForFormat } from "./processors.js";
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
  DetectedFileTypeResult,
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
  ReadFileChunksOptions,
  FileChunk,
  ForEachFileChunkResult,
  RestorePathResult,
  WalkDirectoryOptions,
  WriteEncoding,
  WriteFileOptions,
  WriteFileResult,
  WriteMode,
} from "./types.js";

const DEFAULT_MAX_DEPTH = 8;
export const DEFAULT_MAX_READ_BYTES = 256 * 1024;
export const DEFAULT_MAX_CHUNK_BYTES = 256 * 1024;
const DEFAULT_LIMIT = 50;
const DEFAULT_MAX_CHECKSUM_BYTES = 16 * 1024 * 1024;
export const DEFAULT_MAX_ATOMIC_APPEND_BYTES = 16 * 1024 * 1024;

export interface FileAccessServiceOptions {
  files: FileSystemService;
  paths?: PathService;
  /** Absolute roots; relative tool paths resolve against roots[0]. */
  roots?: string[];
  maxDepth?: number;
  maxReadBytes?: number;
  /** Cap for readFileChunks chunkSize (ADR-0088). */
  maxChunkBytes?: number;
  /** Atomic append rewrite size cap (ADR-0079 / 0088). */
  maxAtomicAppendBytes?: number;
  denyPatterns?: RegExp[];
  /** Max search hits (overridable per findFiles call). */
  defaultLimit?: number;
  /** Capability checks via PermissionManager (ADR-0082). */
  permissions?: PermissionManager;
  /** Optional security/application logger. */
  logger?: Logger;
  /** Fired after successful read/write (ADR-0085 recent files). */
  onAccess?: (event: {
    path: string;
    action: "read" | "write";
    at: string;
  }) => void;
  /** Fired after successful delete/trash or move-away of a path. */
  onPathGone?: (path: string) => void;
  /** Extra ignore patterns (gitignore syntax subset). ADR-0086. */
  ignorePatterns?: string[];
  respectGitignore?: boolean;
  respectAtlasignore?: boolean;
  useBuiltinIgnoreDefaults?: boolean;
  /** Injected ignore engine (tests); otherwise built from options. */
  ignore?: IgnoreRulesEngine;
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
    if (isPlatformError(error)) {
      throw fromPlatformErrorForFs(error);
    }
    throw createFileSystemError("unknown", `Atomic write failed: ${absolute}`, {
      detail: { path: absolute },
      cause: error,
    });
  }
}

export function createFileAccessService(
  options: FileAccessServiceOptions,
): FileAccessService {
  const files = options.files;
  const permissions = options.permissions;
  const logger = options.logger;
  const onAccess = options.onAccess;
  const onPathGone = options.onPathGone;
  const join =
    options.paths?.join.bind(options.paths) ??
    ((...parts: string[]) => path.join(...parts));
  const cwd = options.paths?.cwd() ?? path.resolve(".");
  const roots = (options.roots?.length ? options.roots : [cwd]).map((r) =>
    path.resolve(r),
  );
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxReadBytes = options.maxReadBytes ?? DEFAULT_MAX_READ_BYTES;
  const maxChunkBytes = options.maxChunkBytes ?? DEFAULT_MAX_CHUNK_BYTES;
  const maxAtomicAppendBytes =
    options.maxAtomicAppendBytes ?? DEFAULT_MAX_ATOMIC_APPEND_BYTES;
  const denyPatterns = options.denyPatterns ?? [...DEFAULT_DENY_PATTERNS];
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const ignoreEngine: IgnoreRulesEngine =
    options.ignore ??
    createIgnoreRulesEngine({
      roots,
      patterns: options.ignorePatterns,
      respectGitignore: options.respectGitignore,
      respectAtlasignore: options.respectAtlasignore,
      useBuiltinDefaults: options.useBuiltinIgnoreDefaults,
      readFile: (absolutePath) => {
        try {
          if (!files.exists(absolutePath)) {
            return undefined;
          }
          return files.readText(absolutePath);
        } catch {
          return undefined;
        }
      },
    });

  function noteAccess(absolutePath: string, action: "read" | "write"): void {
    try {
      onAccess?.({
        path: absolutePath,
        action,
        at: new Date().toISOString(),
      });
    } catch {
      // best-effort; never fail the FS op
    }
  }

  function notePathGone(absolutePath: string): void {
    try {
      onPathGone?.(absolutePath);
    } catch {
      // best-effort
    }
  }

  function assertAllowed(absolutePath: string): void {
    if (!isPathInsideRoots(absolutePath, roots)) {
      platformSecurityLog(logger, "warn", "FileAccess path denied", {
        operation: "assertAllowed",
        reason: "outside_roots",
        path: absolutePath,
      });
      throw createFileSystemError(
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
      throw createFileSystemError(
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
    destructive = false,
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
          destructive,
          decisionId: check.decisionId,
          approvalId: check.approval?.id,
        });
        throw createFileSystemError(
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
          destructive,
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
      throw createFileSystemError(
        "permission_denied",
        `Path is outside allowed roots: ${absolutePath}`,
        { detail: { path: absolutePath } },
      );
    }
  }

  interface TrashManifest {
    originalPath: string;
    kind: "file" | "directory";
    deletedAtMs: number;
    payloadName: string;
  }

  /**
   * Soft-move path into Atlas trash; returns trashId for restorePath.
   * Target must pass assertAllowed (not only inside roots).
   */
  function backupToTrash(absolute: string): string {
    assertAllowed(absolute);
    if (isUnderAtlasMeta(absolute)) {
      throw createFileSystemError(
        "invalid_path",
        `Cannot backup Atlas metadata path: ${absolute}`,
        { detail: { path: absolute } },
      );
    }
    if (!files.exists(absolute)) {
      throw createFileSystemError(
        "file_not_found",
        `Path not found: ${absolute}`,
        { detail: { path: absolute } },
      );
    }
    const st = files.stat(absolute);
    const kind: "file" | "directory" = st.isDirectory ? "directory" : "file";
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
    return trashId;
  }

  function ensureDestClear(
    to: string,
    overwrite: boolean,
  ): { overwritten: boolean; backupId?: string } {
    if (!files.exists(to)) {
      return { overwritten: false };
    }
    assertAllowed(to);
    const toStat = files.stat(to);
    if (!overwrite) {
      throw createFileSystemError(
        "invalid_path",
        `Destination already exists: ${to}`,
        { detail: { path: to } },
      );
    }
    if (toStat.isDirectory) {
      const children = files.listDir(to);
      if (children.length > 0) {
        throw createFileSystemError(
          "invalid_path",
          `Destination directory is not empty: ${to}`,
          { detail: { path: to } },
        );
      }
    }
    const backupId = backupToTrash(to);
    return { overwritten: true, backupId };
  }

  function ensureParent(to: string, createDirs: boolean): void {
    const parent = parentDir(to);
    if (parent && parent !== to && !files.exists(parent)) {
      if (!createDirs) {
        throw createFileSystemError(
          "invalid_path",
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
      throw createFileSystemError(
        "invalid_path",
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

  function isSoftIgnored(
    absolutePath: string,
    respectIgnore: boolean,
    isDirectory?: boolean,
  ): boolean {
    if (!respectIgnore) {
      return false;
    }
    return ignoreEngine.shouldIgnore(absolutePath, { isDirectory });
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
        throw createFileSystemError(
          "file_not_found",
          `Directory not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const st = files.lstat(absolute);
      if (st.isSymbolicLink) {
        // Listing a symlink path: follow for "is this a dir?" via stat
        const followed = files.stat(absolute);
        if (!followed.isDirectory) {
          throw createFileSystemError(
            "invalid_path",
            `Not a directory: ${absolute}`,
            { detail: { path: absolute } },
          );
        }
      } else if (!st.isDirectory) {
        throw createFileSystemError(
          "invalid_path",
          `Not a directory: ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      const includeHidden = opts.includeHidden === true;
      const respectIgnore = opts.respectIgnore !== false;
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
        if (!entry) {
          continue;
        }
        if (isSoftIgnored(full, respectIgnore, entry.isDirectory)) {
          continue;
        }
        out.push(entry);
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
      const respectIgnore = opts.respectIgnore !== false;
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
          if (isSoftIgnored(full, respectIgnore, entry.isDirectory)) {
            continue;
          }
          out.push(entry);

          let descend = entry.isDirectory && !entry.isSymbolicLink;
          if (entry.isSymbolicLink && followSymlinks && entry.linkTarget) {
            const target = resolveSymlinkTarget(full, entry.linkTarget);
            if (
              isPathInsideRoots(target, roots) &&
              !matchesDeny(target, denyPatterns) &&
              !isSoftIgnored(target, respectIgnore, true) &&
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
        throw createFileSystemError(
          "file_not_found",
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
          throw createFileSystemError(
            "invalid_path",
            `Not a directory: ${absolute}`,
            { detail: { path: absolute } },
          );
        } else if (rootLstat.isSymbolicLink && !followSymlinks) {
          const followed = files.stat(absolute);
          if (!followed.isDirectory) {
            throw createFileSystemError(
              "invalid_path",
              `Not a directory: ${absolute}`,
              { detail: { path: absolute } },
            );
          }
          // Without followSymlinks, still list through the link path as dir
        } else if (!rootLstat.isDirectory) {
          throw createFileSystemError(
            "invalid_path",
            `Not a directory: ${absolute}`,
            { detail: { path: absolute } },
          );
        }
      } catch (error) {
        if (isPlatformError(error)) {
          throw fromPlatformErrorForFs(error);
        }
        throw createFileSystemError(
          "unknown",
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
      const respectIgnore = query.respectIgnore !== false;
      const filesOnly = query.filesOnly !== false;
      const extensions = normalizeExtensions(query.extensions);
      const searchRoot = query.root ? resolve(query.root) : roots[0]!;
      assertAllowed(searchRoot);

      if (!files.exists(searchRoot)) {
        throw createFileSystemError(
          "file_not_found",
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

          if (isSoftIgnored(full, respectIgnore, isDirectory)) {
            continue;
          }

          scannedEntries += 1;

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
        throw createFileSystemError(
          "file_not_found",
          `File not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const st = files.stat(absolute);
      if (st.isDirectory) {
        throw createFileSystemError(
          "invalid_path",
          `Cannot read a directory as a file: ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      const name = path.basename(absolute);
      const extension = fileExtension(name);
      const offset = opts.offset ?? 0;
      const window = opts.maxBytes ?? maxReadBytes;
      const doParse = opts.parse !== false;

      if (!Number.isFinite(offset) || offset < 0) {
        throw createFileSystemError(
          "invalid_path",
          `Invalid read offset: ${offset}`,
          { detail: { path: absolute } },
        );
      }
      if (!Number.isFinite(window) || window < 0) {
        throw createFileSystemError(
          "invalid_path",
          `Invalid maxBytes: ${window}`,
          { detail: { path: absolute } },
        );
      }

      const bytes = files.readBytes(absolute, {
        offset,
        length: window,
      });
      const sniffBytes =
        offset === 0
          ? bytes.subarray(0, Math.min(bytes.length, DEFAULT_DETECT_BYTES))
          : files.readBytes(absolute, {
              offset: 0,
              length: Math.min(st.size, DEFAULT_DETECT_BYTES),
            });
      const detected = detectFileTypeFromBytes({
        extension,
        bytes: sniffBytes,
      });
      const format = detected.format;
      const mimeType = detected.mimeType;

      if (isUnsupportedBinaryFormat(format)) {
        throw createFileSystemError(
          "unsupported_type",
          `Unsupported binary file type (${mimeType}): ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      const truncated = st.size > offset + bytes.length;
      const decoded = decodeBytes(bytes);

      if (decoded.binaryLike) {
        throw createFileSystemError(
          "unsupported_type",
          `File content appears binary (encoding=${decoded.encoding}): ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      // Re-run text heuristics with decoded sample when sniff was extension-only
      const refined =
        detected.source === "extension" || detected.source === "content"
          ? detectFileTypeFromBytes({
              extension,
              bytes: sniffBytes,
              sampleText: decoded.text.slice(0, DEFAULT_DETECT_BYTES),
            })
          : detected;
      const finalFormat = refined.format;
      const finalMime = refined.mimeType;

      if (isUnsupportedBinaryFormat(finalFormat)) {
        throw createFileSystemError(
          "unsupported_type",
          `Unsupported binary file type (${finalMime}): ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      const result: FileContent = {
        path: absolute,
        content: decoded.text,
        size: st.size,
        format: finalFormat,
        mimeType: finalMime,
        encoding: decoded.encoding,
        byteOffset: offset,
        byteLength: bytes.length,
        truncated,
        detectionSource: refined.source,
        extensionMismatch: refined.extensionMismatch,
      };

      if (doParse && !truncated) {
        if (finalFormat === "json") {
          const parsed = parseJsonSafe(decoded.text);
          if (parsed.data !== undefined) {
            result.data = parsed.data;
          }
          if (parsed.parseError) {
            result.parseError = parsed.parseError;
          }
        } else if (finalFormat === "yaml") {
          const parsed = parseYamlLite(decoded.text);
          if (parsed.data !== undefined) {
            result.data = parsed.data;
          }
          if (parsed.parseError) {
            result.parseError = parsed.parseError;
          }
        } else if (finalFormat === "csv") {
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

      noteAccess(absolute, "read");
      return result;
    },

    *readFileChunks(
      inputPath: string,
      opts: ReadFileChunksOptions = {},
    ): IterableIterator<FileChunk> {
      authorize("filesystem.read", "readFileChunks", inputPath, false);
      const absolute = resolve(inputPath);
      if (!files.exists(absolute)) {
        throw createFileSystemError(
          "file_not_found",
          `File not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const st = files.stat(absolute);
      if (st.isDirectory) {
        throw createFileSystemError(
          "invalid_path",
          `Cannot read a directory as a file: ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      const name = path.basename(absolute);
      const extension = fileExtension(name);
      const head = files.readBytes(absolute, {
        offset: 0,
        length: Math.min(st.size, DEFAULT_DETECT_BYTES),
      });
      const detected = detectFileTypeFromBytes({ extension, bytes: head });
      if (isUnsupportedBinaryFormat(detected.format)) {
        throw createFileSystemError(
          "unsupported_type",
          `Unsupported binary file type (${detected.mimeType}): ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      const startOffset = opts.offset ?? 0;
      const defaultChunk = Math.min(maxReadBytes, maxChunkBytes);
      const chunkSize = opts.chunkSize ?? defaultChunk;
      const budget =
        opts.maxBytes !== undefined ? opts.maxBytes : Number.POSITIVE_INFINITY;

      if (!Number.isFinite(startOffset) || startOffset < 0) {
        throw createFileSystemError(
          "invalid_path",
          `Invalid read offset: ${startOffset}`,
          { detail: { path: absolute } },
        );
      }
      if (!Number.isFinite(chunkSize) || chunkSize < 1) {
        throw createFileSystemError(
          "invalid_path",
          `Invalid chunkSize: ${chunkSize}`,
          { detail: { path: absolute } },
        );
      }
      if (chunkSize > maxChunkBytes) {
        throw createFileSystemError(
          "invalid_path",
          `chunkSize ${chunkSize} exceeds maxChunkBytes ${maxChunkBytes}`,
          { detail: { path: absolute } },
        );
      }
      if (
        opts.maxBytes !== undefined &&
        (!Number.isFinite(opts.maxBytes) || opts.maxBytes < 0)
      ) {
        throw createFileSystemError(
          "invalid_path",
          `Invalid maxBytes: ${opts.maxBytes}`,
          { detail: { path: absolute } },
        );
      }

      let offset = startOffset;
      let index = 0;
      let bytesRead = 0;
      let accessed = false;

      while (offset < st.size && bytesRead < budget) {
        const remainingBudget = budget - bytesRead;
        const length = Math.min(chunkSize, remainingBudget);
        if (length < 1) {
          break;
        }
        const bytes = files.readBytes(absolute, { offset, length });
        if (bytes.length === 0) {
          break;
        }
        const decoded = decodeBytes(bytes);
        if (decoded.binaryLike) {
          throw createFileSystemError(
            "unsupported_type",
            `File content appears binary (encoding=${decoded.encoding}): ${absolute}`,
            { detail: { path: absolute } },
          );
        }
        if (!accessed) {
          noteAccess(absolute, "read");
          accessed = true;
        }
        const nextOffset = offset + bytes.length;
        const moreInFile = nextOffset < st.size;
        const budgetExhausted =
          bytesRead + bytes.length >= budget && moreInFile;
        const eof = !moreInFile;
        yield {
          path: absolute,
          index,
          byteOffset: offset,
          byteLength: bytes.length,
          content: decoded.text,
          truncated: moreInFile || budgetExhausted,
          eof,
        };
        bytesRead += bytes.length;
        offset = nextOffset;
        index += 1;
        if (bytes.length < length) {
          break;
        }
      }
    },

    forEachFileChunk(
      inputPath: string,
      fn: (chunk: FileChunk) => void,
      opts: ReadFileChunksOptions = {},
    ): ForEachFileChunkResult {
      let chunks = 0;
      let bytesRead = 0;
      for (const chunk of this.readFileChunks(inputPath, opts)) {
        fn(chunk);
        chunks += 1;
        bytesRead += chunk.byteLength;
      }
      return { chunks, bytesRead };
    },

    writeFile(
      inputPath: string,
      content: string,
      opts: WriteFileOptions = {},
    ): WriteFileResult {
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
          throw createFileSystemError(
            "invalid_path",
            `Cannot write file over a directory: ${absolute}`,
            { detail: { path: absolute } },
          );
        }
        if (mode === "create") {
          throw createFileSystemError(
            "invalid_path",
            `File already exists: ${absolute}`,
            { detail: { path: absolute } },
          );
        }
      }

      const destructive =
        existed && (mode === "overwrite" || mode === "append");
      const operation = destructive
        ? mode === "append"
          ? "writeFile.append"
          : "writeFile.overwrite"
        : "writeFile.create";
      authorize("filesystem.write", operation, absolute, true, destructive);

      let backupId: string | undefined;
      let priorBytes: Uint8Array | undefined;
      if (destructive) {
        if (mode === "append") {
          priorBytes = files.readBytes(absolute);
        }
        backupId = backupToTrash(absolute);
      }

      const parent = parentDir(absolute);
      if (parent && parent !== absolute && !files.exists(parent)) {
        if (!createDirs) {
          throw createFileSystemError(
            "invalid_path",
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
        const existing = priorBytes ?? new Uint8Array(0);
        if (useAtomic || backupId !== undefined) {
          if (existing.length > maxAtomicAppendBytes) {
            throw createFileSystemError(
              "invalid_path",
              `Atomic append rejected: file exceeds ${maxAtomicAppendBytes} bytes: ${absolute}`,
              { detail: { path: absolute } },
            );
          }
          const merged = new Uint8Array(existing.length + payload.length);
          merged.set(existing, 0);
          merged.set(payload, existing.length);
          if (useAtomic) {
            writeAtomic(files, absolute, merged);
          } else {
            files.writeBytes(absolute, merged);
          }
        } else {
          files.appendBytes(absolute, payload);
        }
        noteAccess(absolute, "write");
        return {
          path: absolute,
          bytesWritten: payload.length,
          encoding,
          mode,
          atomic: useAtomic,
          created: !existed,
          ...(backupId !== undefined ? { backupId, backedUp: true } : {}),
        };
      }

      if (useAtomic) {
        writeAtomic(files, absolute, payload);
      } else {
        try {
          files.writeBytes(absolute, payload);
        } catch (error) {
          if (isPlatformError(error)) {
            throw fromPlatformErrorForFs(error);
          }
          throw createFileSystemError("unknown", `Write failed: ${absolute}`, {
            detail: { path: absolute },
            cause: error,
          });
        }
      }

      noteAccess(absolute, "write");
      return {
        path: absolute,
        bytesWritten: payload.length,
        encoding,
        mode,
        atomic: useAtomic,
        created: !existed,
        ...(backupId !== undefined ? { backupId, backedUp: true } : {}),
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
        throw createFileSystemError(
          "invalid_path",
          `Path exists and is not a directory: ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      if (!recursive) {
        const parent = parentDir(absolute);
        if (parent && parent !== absolute && !files.exists(parent)) {
          throw createFileSystemError(
            "invalid_path",
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
      authorize("filesystem.delete", "deleteDirectory", inputPath, true, true);
      const absolute = resolve(inputPath);
      if (!files.exists(absolute)) {
        throw createFileSystemError(
          "file_not_found",
          `Path not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const st = files.stat(absolute);
      if (!st.isDirectory) {
        throw createFileSystemError(
          "invalid_path",
          `Not a directory: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const children = files.listDir(absolute);
      if (children.length > 0) {
        throw createFileSystemError(
          "invalid_path",
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
      authorize("filesystem.delete", "deletePath", inputPath, true, true);
      const absolute = resolve(inputPath);
      if (!files.exists(absolute)) {
        throw createFileSystemError(
          "file_not_found",
          `Path not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      if (isUnderAtlasMeta(absolute)) {
        throw createFileSystemError(
          "invalid_path",
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
          throw createFileSystemError(
            "invalid_path",
            `Directory is not empty: ${absolute}`,
            { detail: { path: absolute } },
          );
        }
      }

      if (!useTrash) {
        files.remove(absolute);
        notePathGone(absolute);
        return {
          path: absolute,
          kind,
          mode: "hard",
          restorable: false,
        };
      }

      const trashId = backupToTrash(absolute);
      notePathGone(absolute);
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
        true,
      );
      const id = trashId.trim();
      if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) {
        throw createFileSystemError(
          "invalid_path",
          `Invalid trash id: ${trashId}`,
        );
      }
      const entryDir = path.join(trashBase(), id);
      assertInsideRoots(entryDir);
      const manifestPath = path.join(entryDir, "manifest.json");
      if (!files.exists(manifestPath)) {
        throw createFileSystemError(
          "file_not_found",
          `Trash entry not found: ${id}`,
          { detail: { path: entryDir } },
        );
      }
      let manifest: TrashManifest;
      try {
        manifest = JSON.parse(files.readText(manifestPath)) as TrashManifest;
      } catch (error) {
        throw createFileSystemError(
          "invalid_path",
          `Corrupt trash manifest: ${id}`,
          {
            detail: { path: manifestPath },
            cause: error,
          },
        );
      }
      assertAllowed(manifest.originalPath);
      if (files.exists(manifest.originalPath)) {
        throw createFileSystemError(
          "invalid_path",
          `Restore target already exists: ${manifest.originalPath}`,
          { detail: { path: manifest.originalPath } },
        );
      }
      const payloadPath = path.join(entryDir, "payload", manifest.payloadName);
      if (!files.exists(payloadPath)) {
        throw createFileSystemError(
          "file_not_found",
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
      const from = resolve(fromInput);
      const to = resolve(toInput);
      const createDirs = opts.createDirs !== false;
      const overwrite = opts.overwrite === true;
      const recursive = opts.recursive !== false;
      const destExists = files.exists(to);
      const destructive = destExists && overwrite;
      authorize(
        "filesystem.write",
        destructive ? "copyPath.overwrite" : "copyPath",
        `${from}→${to}`,
        true,
        destructive,
      );

      if (!files.exists(from)) {
        throw createFileSystemError(
          "file_not_found",
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
        throw createFileSystemError(
          "invalid_path",
          `Directory copy requires recursive: true: ${from}`,
          { detail: { path: from } },
        );
      }

      const cleared = ensureDestClear(to, overwrite);
      ensureParent(to, createDirs);

      if (kind === "file") {
        files.copyFile(from, to);
        return {
          from,
          to,
          kind,
          bytesCopied: fromStat.size,
          overwritten: cleared.overwritten,
          ...(cleared.backupId !== undefined
            ? { backupId: cleared.backupId, backedUp: true }
            : {}),
        };
      }

      copyTree(from, to);
      return {
        from,
        to,
        kind,
        overwritten: cleared.overwritten,
        ...(cleared.backupId !== undefined
          ? { backupId: cleared.backupId, backedUp: true }
          : {}),
      };
    },

    movePath(
      fromInput: string,
      toInput: string,
      opts: MovePathOptions = {},
    ): MovePathResult {
      const from = resolve(fromInput);
      const to = resolve(toInput);
      const createDirs = opts.createDirs !== false;
      const overwrite = opts.overwrite === true;
      const destExists = files.exists(to);
      const destructive = destExists && overwrite;
      authorize(
        ["filesystem.write", "filesystem.delete"],
        destructive ? "movePath.overwrite" : "movePath",
        `${from}→${to}`,
        true,
        destructive,
      );

      if (!files.exists(from)) {
        throw createFileSystemError(
          "file_not_found",
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
      const cleared = ensureDestClear(to, overwrite);
      ensureParent(to, createDirs);
      files.rename(from, to);
      if (from !== to) {
        notePathGone(from);
        noteAccess(to, "write");
      }
      return {
        from,
        to,
        kind,
        ...(cleared.backupId !== undefined
          ? { backupId: cleared.backupId, backedUp: true }
          : {}),
      };
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
        throw createFileSystemError(
          "file_not_found",
          `Path not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }

      const followSymlinks = opts.followSymlinks !== false;
      const includeChecksum = opts.includeChecksum !== false;
      const includeTypeDetection = opts.includeTypeDetection !== false;
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

      if (
        includeTypeDetection &&
        st.isFile &&
        !st.isDirectory &&
        !st.isSymbolicLink
      ) {
        try {
          const head = files.readBytes(absolute, {
            offset: 0,
            length: Math.min(st.size, DEFAULT_DETECT_BYTES),
          });
          const detected = detectFileTypeFromBytes({
            extension,
            bytes: head,
          });
          meta.mimeType = detected.mimeType;
          meta.format = detected.format;
          meta.detectionSource = detected.source;
          meta.extensionMismatch = detected.extensionMismatch;
        } catch {
          // keep extension MIME on sniff failure
        }
      }

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

    detectFileType(inputPath: string): DetectedFileTypeResult {
      authorize("filesystem.read", "detectFileType", inputPath, false);
      const absolute = resolve(inputPath);
      if (!files.exists(absolute)) {
        throw createFileSystemError(
          "file_not_found",
          `Path not found: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const st = files.stat(absolute);
      if (st.isDirectory) {
        throw createFileSystemError(
          "invalid_path",
          `Cannot detect type of a directory: ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const extension = fileExtension(path.basename(absolute));
      const head = files.readBytes(absolute, {
        offset: 0,
        length: Math.min(st.size, DEFAULT_DETECT_BYTES),
      });
      let detected = detectFileTypeFromBytes({ extension, bytes: head });
      if (
        !isUnsupportedBinaryFormat(detected.format) &&
        (detected.source === "extension" || detected.source === "content")
      ) {
        const decoded = decodeBytes(head);
        if (!decoded.binaryLike) {
          detected = detectFileTypeFromBytes({
            extension,
            bytes: head,
            sampleText: decoded.text.slice(0, DEFAULT_DETECT_BYTES),
          });
        }
      }
      return {
        path: absolute,
        mimeType: detected.mimeType,
        format: detected.format,
        extensionMime: detected.extensionMime,
        extensionFormat: detected.extensionFormat,
        source: detected.source,
        confidence: detected.confidence,
        ...(detected.signatureId !== undefined
          ? { signatureId: detected.signatureId }
          : {}),
        extensionMismatch: detected.extensionMismatch,
        processor: processorForFormat(detected.format),
        indexable: isIndexableFormat(detected.format),
      };
    },
  };
}
