/**
 * FileAccessService — product FS layer over injected os.files (ADR-0074).
 */
import path from "node:path";

import {
  PlatformError,
  type FileSystemService,
  type PathService,
} from "@atlas-ai/platform";

import {
  DEFAULT_DENY_PATTERNS,
  isPathInsideRoots,
  matchesDeny,
  patternToRegExp,
  resolveWithinRoots,
} from "./paths.js";
import type {
  FileAccessService,
  FileContent,
  FileHit,
  FindFilesQuery,
  ListDirectoryOptions,
  DirEntry,
  WalkDirectoryOptions,
  WriteFileOptions,
} from "./types.js";

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_READ_BYTES = 256 * 1024;
const DEFAULT_LIMIT = 50;

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

    findFiles(query: FindFilesQuery): FileHit[] {
      const pattern = query.pattern?.trim() ?? "";
      const matcher = patternToRegExp(pattern);
      const limit = query.limit ?? defaultLimit;
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

      const visit = (dir: string, depth: number): void => {
        if (hits.length >= limit || depth > maxDepth) {
          return;
        }
        let names: string[];
        try {
          names = files.listDir(dir);
        } catch {
          return;
        }
        for (const name of names) {
          if (hits.length >= limit) {
            return;
          }
          const full = join(dir, name);
          if (matchesDeny(full, denyPatterns)) {
            continue;
          }
          if (!isPathInsideRoots(full, roots)) {
            continue;
          }

          let isDirectory = false;
          let size: number | undefined;
          try {
            const st = files.stat(full);
            isDirectory = st.isDirectory;
            size = st.size;
          } catch {
            continue;
          }

          if (matcher.test(name)) {
            hits.push({
              path: full,
              name,
              isDirectory,
              size,
              match: "name",
            });
            if (hits.length >= limit) {
              return;
            }
          } else if (
            query.content &&
            !isDirectory &&
            size !== undefined &&
            size <= maxReadBytes
          ) {
            try {
              const text = files.readText(full);
              if (
                matcher.test(text) ||
                text.toLowerCase().includes(pattern.toLowerCase())
              ) {
                hits.push({
                  path: full,
                  name,
                  isDirectory: false,
                  size,
                  match: "content",
                });
              }
            } catch {
              // skip unreadable
            }
          }

          if (isDirectory) {
            visit(full, depth + 1);
          }
        }
      };

      const rootStat = files.stat(searchRoot);
      if (rootStat.isFile) {
        const name = path.basename(searchRoot);
        if (matcher.test(name)) {
          hits.push({
            path: searchRoot,
            name,
            isDirectory: false,
            size: rootStat.size,
            match: "name",
          });
        }
        return hits;
      }

      visit(searchRoot, 0);
      return hits;
    },

    readFile(inputPath: string): FileContent {
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
      if (st.size > maxReadBytes) {
        throw new PlatformError(
          "invalid_input",
          `File exceeds max read size (${maxReadBytes} bytes): ${absolute}`,
          { detail: { path: absolute } },
        );
      }
      const content = files.readText(absolute);
      return { path: absolute, content, size: st.size };
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
  };
}
