import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __resetDefaultFileAccessServiceForTests,
  createFileAccessService,
  createMemoryFileSystemService,
  setDefaultFileAccessService,
} from "@atlas-ai/filesystem";

import { executeTool, getDefaultToolRegistry } from "../index.js";

const ROOT = "/workspace";

describe("file.* builtin tools", () => {
  beforeEach(() => {
    const files = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/hello.txt`]: "hello atlas",
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
  });

  it("registers all file tools", () => {
    const names = getDefaultToolRegistry()
      .list()
      .map((t) => t.metadata.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "file.search",
        "file.read",
        "file.write",
        "file.mkdir",
        "file.delete",
        "file.move",
        "file.resolve",
        "file.list",
        "file.walk",
        "file.metadata",
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
    expect(
      executeTool({
        name: "file.write",
        input: { path: "out.txt", content: "new" },
      }).ok,
    ).toBe(true);

    expect(
      executeTool({
        name: "file.mkdir",
        input: { path: "nested/dir" },
      }).ok,
    ).toBe(true);

    expect(
      executeTool({
        name: "file.move",
        input: { from: "out.txt", to: "nested/dir/out.txt" },
      }).ok,
    ).toBe(true);

    expect(
      executeTool({
        name: "file.delete",
        input: { path: "nested/dir/out.txt" },
      }).ok,
    ).toBe(true);
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
});
