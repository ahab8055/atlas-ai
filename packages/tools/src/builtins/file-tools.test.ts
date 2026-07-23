import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __resetDefaultFileAccessServiceForTests,
  __resetRecentFilesStoreForTests,
  createFileAccessService,
  createMemoryFileSystemService,
  setDefaultFileAccessService,
  setRecentFilesStore,
} from "@atlas-ai/filesystem";

import { executeTool, getDefaultToolRegistry } from "../index.js";

const ROOT = "/workspace";

describe("file.* builtin tools", () => {
  beforeEach(() => {
    const files = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/hello.txt`]: "hello atlas",
      [`${ROOT}/data.json`]: '{"ok":true}',
      [`${ROOT}/src`]: null,
      [`${ROOT}/src/main.ts`]: "const n = 1;",
    });
    setDefaultFileAccessService(
      createFileAccessService({
        files,
        roots: [ROOT],
        paths: {
          homeDir: () => "/home",
          tempDir: () => "/tmp",
          userDataDir: () => "/home/.atlas",
          cacheDir: () => "/home/.cache",
          cwd: () => ROOT,
          join: (...parts: string[]) => path.posix.join(...parts),
        },
      }),
    );
  });

  afterEach(() => {
    __resetDefaultFileAccessServiceForTests();
    __resetRecentFilesStoreForTests();
  });

  it("registers all file tools", () => {
    const names = getDefaultToolRegistry()
      .list()
      .map((t) => t.metadata.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "file.search",
        "file.read",
        "file.read.chunks",
        "file.write",
        "file.mkdir",
        "file.delete",
        "file.move",
        "file.copy",
        "file.rename",
        "file.restore",
        "file.rmdir",
        "file.exists",
        "file.resolve",
        "file.list",
        "file.walk",
        "file.metadata",
        "file.recent",
        "file.index.search",
      ]),
    );
  });

  it("searches and reads via FileAccessService", () => {
    const search = executeTool({
      name: "file.search",
      input: { query: "hello*" },
    });
    expect(search.ok).toBe(true);
    expect(search.status).toBe("completed");
    expect(search.output?.data?.hits).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "hello.txt" })]),
    );
    expect(typeof search.output?.data?.scannedEntries).toBe("number");
    expect(typeof search.output?.data?.durationMs).toBe("number");

    const filtered = executeTool({
      name: "file.search",
      input: { query: "*", extensions: [".ts"], maxDepth: 4 },
    });
    expect(filtered.ok).toBe(true);
    expect(filtered.output?.data?.hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "main.ts", extension: ".ts" }),
      ]),
    );

    const read = executeTool({
      name: "file.read",
      input: { path: "hello.txt" },
    });
    expect(read.ok).toBe(true);
    expect(read.output?.data?.content).toBe("hello atlas");
    expect(read.output?.data?.format).toBe("text");
    expect(read.output?.data?.encoding).toBe("utf-8");
    expect(read.output?.data?.truncated).toBe(false);

    const json = executeTool({
      name: "file.read",
      input: { path: "data.json" },
    });
    expect(json.ok).toBe(true);
    expect(json.output?.data?.format).toBe("json");
    expect(json.output?.data?.data).toEqual({ ok: true });
  });

  it("returns file metadata via FileAccessService", () => {
    const result = executeTool({
      name: "file.metadata",
      input: { path: "hello.txt" },
    });
    expect(result.ok).toBe(true);
    expect(result.output?.data?.metadata).toMatchObject({
      name: "hello.txt",
      extension: ".txt",
      mimeType: "text/plain",
    });
    expect(
      (result.output?.data?.metadata as { checksum?: { hex: string } })
        ?.checksum?.hex,
    ).toHaveLength(64);
  });

  it("resolves, lists, and walks directories", () => {
    const resolved = executeTool({
      name: "file.resolve",
      input: { path: "src/main.ts" },
    });
    expect(resolved.ok).toBe(true);
    expect(resolved.output?.data?.path).toBe(`${ROOT}/src/main.ts`);

    const listed = executeTool({
      name: "file.list",
      input: {},
    });
    expect(listed.ok).toBe(true);
    expect(listed.output?.data?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "hello.txt" }),
        expect.objectContaining({ name: "src", isDirectory: true }),
      ]),
    );

    const walked = executeTool({
      name: "file.walk",
      input: { maxDepth: 4 },
    });
    expect(walked.ok).toBe(true);
    expect(walked.output?.data?.entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "main.ts" })]),
    );
  });

  it("writes, moves, and deletes", () => {
    const wrote = executeTool({
      name: "file.write",
      input: { path: "out.txt", content: "new" },
    });
    expect(wrote.ok).toBe(true);
    expect(wrote.output?.data?.mode).toBe("overwrite");
    expect(wrote.output?.data?.atomic).toBe(true);
    expect(wrote.output?.data?.created).toBe(true);
    expect(typeof wrote.output?.data?.bytesWritten).toBe("number");

    const appended = executeTool({
      name: "file.write",
      input: {
        path: "out.txt",
        content: "!",
        mode: "append",
        atomic: false,
      },
    });
    expect(appended.ok).toBe(true);
    expect(appended.output?.data?.mode).toBe("append");

    const mkdir = executeTool({
      name: "file.mkdir",
      input: { path: "nested/dir" },
    });
    expect(mkdir.ok).toBe(true);
    expect(mkdir.output?.data?.created).toBe(true);

    const exists = executeTool({
      name: "file.exists",
      input: { path: "nested/dir" },
    });
    expect(exists.ok).toBe(true);
    expect(exists.output?.data?.exists).toBe(true);
    expect(exists.output?.data?.isDirectory).toBe(true);

    const moved = executeTool({
      name: "file.move",
      input: { from: "out.txt", to: "nested/dir/out.txt" },
    });
    expect(moved.ok).toBe(true);
    expect(moved.output?.data?.kind).toBe("file");

    const copied = executeTool({
      name: "file.copy",
      input: { from: "nested/dir/out.txt", to: "nested/dir/out2.txt" },
    });
    expect(copied.ok).toBe(true);
    expect(copied.output?.data?.kind).toBe("file");

    const deleted = executeTool({
      name: "file.delete",
      input: { path: "nested/dir/out2.txt" },
    });
    expect(deleted.ok).toBe(true);
    expect(deleted.output?.data?.mode).toBe("trash");
    expect(deleted.output?.data?.trashId).toBeTruthy();

    const restored = executeTool({
      name: "file.restore",
      input: { trashId: deleted.output?.data?.trashId },
    });
    expect(restored.ok).toBe(true);

    expect(
      executeTool({
        name: "file.delete",
        input: { path: "nested/dir/out2.txt", trash: false },
      }).ok,
    ).toBe(true);

    expect(
      executeTool({
        name: "file.delete",
        input: { path: "nested/dir/out.txt", trash: false },
      }).ok,
    ).toBe(true);

    const rmdir = executeTool({
      name: "file.rmdir",
      input: { path: "nested/dir" },
    });
    expect(rmdir.ok).toBe(true);
  });

  it("returns failed when FileAccess is not bootstrapped", () => {
    __resetDefaultFileAccessServiceForTests();
    const result = executeTool({
      name: "file.read",
      input: { path: "hello.txt" },
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
  });

  it("reads large files in bounded chunks via file.read.chunks", () => {
    const body = "abcdefghijklmnopqrstuvwxyz0123456789";
    setDefaultFileAccessService(
      createFileAccessService({
        files: createMemoryFileSystemService({
          [ROOT]: null,
          [`${ROOT}/huge.txt`]: body,
        }),
        roots: [ROOT],
        maxChunkBytes: 8,
        maxReadBytes: 8,
        paths: {
          homeDir: () => "/home",
          tempDir: () => "/tmp",
          userDataDir: () => "/home/.atlas",
          cacheDir: () => "/home/.cache",
          cwd: () => ROOT,
          join: (...parts: string[]) => path.posix.join(...parts),
        },
      }),
    );

    const result = executeTool({
      name: "file.read.chunks",
      input: { path: "huge.txt", chunkSize: 8, maxChunks: 2 },
    });
    expect(result.ok).toBe(true);
    expect(result.output?.data?.chunksReturned).toBe(2);
    expect(result.output?.data?.truncated).toBe(true);
    const chunks = result.output?.data?.chunks as Array<{ content: string }>;
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.content).toBe("abcdefgh");
    expect(chunks[1]?.content).toBe("ijklmnop");
  });

  it("lists recent files via injected store", () => {
    setRecentFilesStore({
      list: () => [
        {
          path: `${ROOT}/hello.txt`,
          lastAction: "read",
          lastAccessedAt: "2026-01-01T12:00:00.000Z",
          accessCount: 2,
        },
      ],
    });

    const result = executeTool({
      name: "file.recent",
      input: { limit: 5, sort: "recent" },
    });
    expect(result.ok).toBe(true);
    expect(result.output?.data?.files).toEqual([
      {
        path: `${ROOT}/hello.txt`,
        lastAction: "read",
        lastAccessedAt: "2026-01-01T12:00:00.000Z",
        accessCount: 2,
      },
    ]);
  });
});
