import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { PlatformError } from "@atlas-ai/platform";
import { PermissionManager } from "@atlas-ai/security";

import {
  createFileWatcherService,
  createMemoryFileSystemService,
  type FileSystemEventType,
} from "./index.js";

const ROOT = "/workspace";

describe("FileWatcherService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes memory watch events and publishes to subscribers", () => {
    vi.useFakeTimers();
    const files = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/a.txt`]: "hi",
    });
    const published: { type: FileSystemEventType; path: string }[] = [];
    const svc = createFileWatcherService({
      files,
      roots: [ROOT],
      onFileEvent: {
        publish(type, payload) {
          published.push({ type, path: payload.path });
        },
      },
      paths: {
        homeDir: () => "/home/test",
        tempDir: () => "/tmp",
        userDataDir: () => "/home/test/.atlas",
        cacheDir: () => "/home/test/.cache",
        cwd: () => ROOT,
        join: (...parts: string[]) => path.posix.join(...parts),
      },
    });

    const watch = svc.watchDirectory(".", { debounceMs: 20 });
    files.emitWatchEvent({ type: "rename", path: `${ROOT}/b.txt` });
    // create: path does not exist in store yet — simulate create by writing then rename event
    files.writeText(`${ROOT}/b.txt`, "x");
    files.emitWatchEvent({ type: "rename", path: `${ROOT}/b.txt` });
    vi.advanceTimersByTime(25);

    expect(published.some((e) => e.type === "FileCreated")).toBe(true);
    expect(published.some((e) => e.type === "FolderChanged")).toBe(true);

    published.length = 0;
    files.emitWatchEvent({ type: "change", path: `${ROOT}/b.txt` });
    vi.advanceTimersByTime(25);
    expect(published.some((e) => e.type === "FileUpdated")).toBe(true);

    published.length = 0;
    files.remove(`${ROOT}/b.txt`);
    files.emitWatchEvent({ type: "rename", path: `${ROOT}/b.txt` });
    vi.advanceTimersByTime(25);
    expect(published.some((e) => e.type === "FileDeleted")).toBe(true);

    watch.stop();
  });

  it("correlates delete+create into FileRenamed", () => {
    vi.useFakeTimers();
    const files = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/old.txt`]: "x",
    });
    const published: { type: string; from?: string; to?: string }[] = [];
    const svc = createFileWatcherService({
      files,
      roots: [ROOT],
      onFileEvent: {
        publish(type, payload) {
          published.push({
            type,
            from: "from" in payload ? payload.from : undefined,
            to: "to" in payload ? payload.to : undefined,
            path: payload.path,
          } as { type: string; from?: string; to?: string });
        },
      },
      paths: {
        homeDir: () => "/home/test",
        tempDir: () => "/tmp",
        userDataDir: () => "/home/test/.atlas",
        cacheDir: () => "/home/test/.cache",
        cwd: () => ROOT,
        join: (...parts: string[]) => path.posix.join(...parts),
      },
    });

    svc.watchDirectory(".", { debounceMs: 30 });
    // seed known set via prior create
    files.emitWatchEvent({ type: "rename", path: `${ROOT}/old.txt` });
    vi.advanceTimersByTime(35);

    published.length = 0;
    files.remove(`${ROOT}/old.txt`);
    files.writeText(`${ROOT}/new.txt`, "x");
    files.emitWatchEvent({ type: "rename", path: `${ROOT}/old.txt` });
    files.emitWatchEvent({ type: "rename", path: `${ROOT}/new.txt` });
    vi.advanceTimersByTime(35);

    const renamed = published.find((e) => e.type === "FileRenamed");
    expect(renamed).toBeDefined();
    expect(renamed?.from).toBe(`${ROOT}/old.txt`);
    expect(renamed?.to).toBe(`${ROOT}/new.txt`);
    svc.stopAll();
  });

  it("drops events under builtin ignore paths", () => {
    vi.useFakeTimers();
    const files = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/node_modules`]: null,
      [`${ROOT}/ok.txt`]: "x",
    });
    const published: { type: string; path: string }[] = [];
    const svc = createFileWatcherService({
      files,
      roots: [ROOT],
      onFileEvent: {
        publish(type, payload) {
          published.push({ type, path: payload.path });
        },
      },
      paths: {
        homeDir: () => "/home/test",
        tempDir: () => "/tmp",
        userDataDir: () => "/home/test/.atlas",
        cacheDir: () => "/home/test/.cache",
        cwd: () => ROOT,
        join: (...parts: string[]) => path.posix.join(...parts),
      },
    });

    svc.watchDirectory(".", { debounceMs: 20 });
    files.writeText(`${ROOT}/node_modules/x.js`, "1");
    files.emitWatchEvent({
      type: "rename",
      path: `${ROOT}/node_modules/x.js`,
    });
    files.writeText(`${ROOT}/ok2.txt`, "2");
    files.emitWatchEvent({ type: "rename", path: `${ROOT}/ok2.txt` });
    vi.advanceTimersByTime(25);

    expect(published.some((e) => e.path.includes("node_modules"))).toBe(false);
    expect(published.some((e) => e.path.endsWith("ok2.txt"))).toBe(true);
    svc.stopAll();
  });

  it("blocks watch outside roots and without filesystem.read", () => {
    const files = createMemoryFileSystemService({ [ROOT]: null });
    const permissions = new PermissionManager({ grantedCapabilities: [] });
    const svc = createFileWatcherService({
      files,
      roots: [ROOT],
      permissions,
      paths: {
        homeDir: () => "/home/test",
        tempDir: () => "/tmp",
        userDataDir: () => "/home/test/.atlas",
        cacheDir: () => "/home/test/.cache",
        cwd: () => ROOT,
        join: (...parts: string[]) => path.posix.join(...parts),
      },
    });

    expect(() => svc.watchDirectory(".")).toThrow(PlatformError);
    permissions.grant("filesystem.read");
    expect(() => svc.watchDirectory("/etc")).toThrow(PlatformError);
  });
});
