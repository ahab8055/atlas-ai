/**
 * FileWatcherService — product FS watch layer (ADR-0084).
 */
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { Logger } from "@atlas-ai/logging";
import {
  PlatformError,
  platformSecurityLog,
  type FileSystemService,
  type FileWatchEvent,
  type FileWatchHandle,
  type PathService,
} from "@atlas-ai/platform";
import type { PermissionManager } from "@atlas-ai/security";

import {
  emitFileSystemEvent,
  type FileSystemEventPublisher,
  type FileSystemEventType,
} from "./events.js";
import {
  DEFAULT_DENY_PATTERNS,
  isPathInsideRoots,
  matchesDeny,
  resolveWithinRoots,
} from "./paths.js";

const DEFAULT_DEBOUNCE_MS = 100;

export interface WatchDirectoryOptions {
  recursive?: boolean;
  debounceMs?: number;
  /** Basename substrings / simple globs (* and ?) to ignore. */
  ignoreGlobs?: string[];
}

export interface WatchHandle {
  id: string;
  stop(): void;
}

export interface FileWatcherService {
  watchDirectory(
    inputPath?: string,
    options?: WatchDirectoryOptions,
  ): WatchHandle;
  stopAll(): void;
  listWatches(): readonly string[];
}

export interface FileWatcherServiceOptions {
  files: FileSystemService;
  paths?: PathService;
  roots?: string[];
  denyPatterns?: RegExp[];
  permissions?: PermissionManager;
  logger?: Logger;
  onFileEvent?: FileSystemEventPublisher;
}

interface PendingSlot {
  kind: "created" | "updated" | "deleted";
  path: string;
  isDirectory: boolean;
  at: number;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function parentOf(absolute: string): string {
  return path.dirname(absolute);
}

export function createFileWatcherService(
  options: FileWatcherServiceOptions,
): FileWatcherService {
  const files = options.files;
  const permissions = options.permissions;
  const logger = options.logger;
  const onFileEvent = options.onFileEvent;
  const join =
    options.paths?.join.bind(options.paths) ??
    ((...parts: string[]) => path.join(...parts));
  const cwd = options.paths?.cwd() ?? path.resolve(".");
  const roots = (options.roots?.length ? options.roots : [cwd]).map((r) =>
    path.resolve(r),
  );
  const denyPatterns = options.denyPatterns ?? [...DEFAULT_DENY_PATTERNS];

  const active = new Map<
    string,
    {
      root: string;
      handle: FileWatchHandle;
      debounceMs: number;
      ignore: RegExp[];
      known: Set<string>;
      pending: Map<string, PendingSlot>;
      timer: ReturnType<typeof setTimeout> | undefined;
    }
  >();

  function assertAllowed(absolutePath: string): void {
    if (!isPathInsideRoots(absolutePath, roots)) {
      platformSecurityLog(logger, "warn", "FileWatch path denied", {
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
      platformSecurityLog(logger, "warn", "FileWatch path denied", {
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

  function authorize(resource: string): void {
    if (!permissions) {
      return;
    }
    const check = permissions.requestPermission({
      capability: "filesystem.read",
      reason: "watchDirectory",
      resource,
    });
    if (check.blocked) {
      platformSecurityLog(logger, "warn", "FileWatch permission denied", {
        operation: "watchDirectory",
        capability: "filesystem.read",
        path: resource,
        approvalId: check.approval?.id,
      });
      throw new PlatformError(
        "permission_denied",
        check.evaluation.message ||
          "Permission denied for filesystem.read (watchDirectory)",
        { approvalId: check.approval?.id, detail: { path: resource } },
      );
    }
  }

  function shouldIgnore(absolute: string, ignore: RegExp[]): boolean {
    const base = path.basename(absolute);
    if (matchesDeny(absolute, denyPatterns)) {
      return true;
    }
    return ignore.some((re) => re.test(base) || re.test(absolute));
  }

  function publish(
    watchId: string,
    root: string,
    type: FileSystemEventType,
    pathAbs: string,
    isDirectory: boolean,
    extra?: { from: string; to: string },
  ): void {
    if (type === "FileRenamed" && extra) {
      emitFileSystemEvent(onFileEvent, "FileRenamed", {
        path: extra.to,
        from: extra.from,
        to: extra.to,
        isDirectory,
        watchId,
        root,
      });
      return;
    }
    if (type === "FileRenamed") {
      return;
    }
    emitFileSystemEvent(onFileEvent, type, {
      path: pathAbs,
      isDirectory,
      watchId,
      root,
    });
    if (isDirectory || type === "FileCreated" || type === "FileDeleted") {
      const parent = parentOf(pathAbs);
      if (parent && parent !== pathAbs && isPathInsideRoots(parent, roots)) {
        emitFileSystemEvent(onFileEvent, "FolderChanged", {
          path: parent,
          isDirectory: true,
          watchId,
          root,
        });
      }
    }
  }

  function flushPending(watchId: string): void {
    const state = active.get(watchId);
    if (!state) {
      return;
    }
    state.timer = undefined;
    const slots = [...state.pending.values()];
    state.pending.clear();

    // Best-effort rename: one deleted + one created under same parent in window
    const deleted = slots.filter((s) => s.kind === "deleted");
    const created = slots.filter((s) => s.kind === "created");
    const used = new Set<string>();

    for (const del of deleted) {
      const parent = parentOf(del.path);
      const match = created.find(
        (c) =>
          !used.has(c.path) &&
          parentOf(c.path) === parent &&
          c.path !== del.path &&
          c.isDirectory === del.isDirectory,
      );
      if (match) {
        used.add(del.path);
        used.add(match.path);
        state.known.delete(del.path);
        state.known.add(match.path);
        publish(
          watchId,
          state.root,
          "FileRenamed",
          match.path,
          match.isDirectory,
          {
            from: del.path,
            to: match.path,
          },
        );
        emitFileSystemEvent(onFileEvent, "FolderChanged", {
          path: parent,
          isDirectory: true,
          watchId,
          root: state.root,
        });
      }
    }

    for (const slot of slots) {
      if (used.has(slot.path)) {
        continue;
      }
      if (slot.kind === "created") {
        state.known.add(slot.path);
        publish(
          watchId,
          state.root,
          "FileCreated",
          slot.path,
          slot.isDirectory,
        );
      } else if (slot.kind === "updated") {
        state.known.add(slot.path);
        publish(
          watchId,
          state.root,
          "FileUpdated",
          slot.path,
          slot.isDirectory,
        );
      } else {
        state.known.delete(slot.path);
        publish(
          watchId,
          state.root,
          "FileDeleted",
          slot.path,
          slot.isDirectory,
        );
      }
    }
  }

  function scheduleFlush(watchId: string): void {
    const state = active.get(watchId);
    if (!state) {
      return;
    }
    if (state.timer) {
      clearTimeout(state.timer);
    }
    state.timer = setTimeout(() => flushPending(watchId), state.debounceMs);
  }

  function onRaw(watchId: string, event: FileWatchEvent): void {
    const state = active.get(watchId);
    if (!state) {
      return;
    }
    const absolute = path.resolve(event.path);
    if (!isPathInsideRoots(absolute, roots)) {
      return;
    }
    if (shouldIgnore(absolute, state.ignore)) {
      return;
    }

    const exists = files.exists(absolute);
    let isDirectory = false;
    if (exists) {
      try {
        isDirectory = files.stat(absolute).isDirectory;
      } catch {
        isDirectory = false;
      }
    } else {
      isDirectory = state.known.has(absolute) ? false : absolute === state.root;
    }

    const known = state.known.has(absolute);
    let kind: PendingSlot["kind"];
    if (event.type === "change" && exists) {
      kind = "updated";
    } else if (exists) {
      kind = known ? "updated" : "created";
    } else {
      kind = "deleted";
    }

    state.pending.set(absolute, {
      kind,
      path: absolute,
      isDirectory,
      at: Date.now(),
    });
    scheduleFlush(watchId);
  }

  return {
    watchDirectory(
      inputPath?: string,
      opts: WatchDirectoryOptions = {},
    ): WatchHandle {
      const target =
        inputPath !== undefined
          ? resolveWithinRoots(inputPath, roots, join)
          : roots[0]!;
      assertAllowed(target);
      authorize(target);

      if (!files.exists(target)) {
        throw new PlatformError(
          "resource_not_found",
          `Watch path not found: ${target}`,
          { detail: { path: target } },
        );
      }
      const st = files.stat(target);
      if (!st.isDirectory) {
        throw new PlatformError(
          "invalid_input",
          `Watch path is not a directory: ${target}`,
          { detail: { path: target } },
        );
      }

      const id = randomUUID();
      const recursive = opts.recursive !== false;
      const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
      const ignore = (opts.ignoreGlobs ?? []).map(globToRegExp);

      const handle = files.watch(target, (event) => onRaw(id, event), {
        recursive,
      });

      active.set(id, {
        root: target,
        handle,
        debounceMs,
        ignore,
        known: new Set(),
        pending: new Map(),
        timer: undefined,
      });

      platformSecurityLog(logger, "info", "FileWatch started", {
        operation: "watchDirectory",
        path: target,
        watchId: id,
        recursive,
      });

      return {
        id,
        stop() {
          const state = active.get(id);
          if (!state) {
            return;
          }
          if (state.timer) {
            clearTimeout(state.timer);
          }
          state.handle.close();
          active.delete(id);
        },
      };
    },

    stopAll(): void {
      for (const id of [...active.keys()]) {
        const state = active.get(id);
        if (!state) {
          continue;
        }
        if (state.timer) {
          clearTimeout(state.timer);
        }
        state.handle.close();
        active.delete(id);
      }
    },

    listWatches(): readonly string[] {
      return [...active.keys()];
    },
  };
}
