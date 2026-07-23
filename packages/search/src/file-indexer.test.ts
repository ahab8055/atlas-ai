import path from "node:path";

import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";
import {
  createFileAccessService,
  createMemoryFileSystemService,
} from "@atlas-ai/filesystem";

import { createFileIndexingService } from "./file-indexer.js";

const ROOT = "/workspace";

function buildFiles() {
  const mem = createMemoryFileSystemService({
    [ROOT]: null,
    [`${ROOT}/src`]: null,
    [`${ROOT}/src/app.ts`]: "export const hello = 'atlas indexing';",
    [`${ROOT}/readme.md`]: "# Atlas",
    [`${ROOT}/photo.png`]: "binary-ish",
    [`${ROOT}/node_modules`]: null,
    [`${ROOT}/node_modules/pkg`]: null,
    [`${ROOT}/node_modules/pkg/index.js`]: "ignored module",
  });
  const files = createFileAccessService({
    files: mem,
    roots: [ROOT],
    paths: {
      homeDir: () => "/home",
      tempDir: () => "/tmp",
      userDataDir: () => "/home/.atlas",
      cacheDir: () => "/home/.cache",
      cwd: () => ROOT,
      join: (...parts: string[]) => path.posix.join(...parts),
    },
  });
  return { mem, files };
}

describe("FileIndexingService", () => {
  it("builds an ignore-aware index and supports incremental events", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    const { files } = buildFiles();
    const indexer = createFileIndexingService({ database: db, files });

    const built = indexer.build({ root: ROOT, maxDepth: 6 });
    expect(built.scanned).toBeGreaterThan(0);
    expect(built.indexed).toBeGreaterThanOrEqual(2);
    expect(
      indexer
        .search({ query: "indexing" })
        .some((h) => h.path.endsWith("app.ts")),
    ).toBe(true);
    expect(
      indexer
        .search({ query: "ignored" })
        .some((h) => h.path.includes("node_modules")),
    ).toBe(false);

    // unchanged on rebuild
    const again = indexer.indexPath(`${ROOT}/src/app.ts`);
    expect(again).toBe("unchanged");

    indexer.applyFsEvent("FileDeleted", {
      path: `${ROOT}/src/app.ts`,
      isDirectory: false,
      watchId: "w1",
      root: ROOT,
    });
    expect(indexer.search({ query: "indexing" })).toHaveLength(0);

    // re-create via event
    files.writeFile("src/app.ts", "export const hello = 'atlas indexing';");
    indexer.applyFsEvent("FileCreated", {
      path: `${ROOT}/src/app.ts`,
      isDirectory: false,
      watchId: "w1",
      root: ROOT,
    });
    expect(indexer.search({ query: "indexing" }).length).toBeGreaterThan(0);

    const status = indexer.status();
    expect(status.total).toBeGreaterThan(0);

    db.close();
  });

  it("indexes mislabeled JSON and skips mislabeled PNG via detection", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    const mem = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/data.txt`]: '{"keyword":"detectme"}',
      [`${ROOT}/fake.txt`]: "",
    });
    mem.writeBytes(
      `${ROOT}/fake.txt`,
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    const files = createFileAccessService({
      files: mem,
      roots: [ROOT],
      paths: {
        homeDir: () => "/home",
        tempDir: () => "/tmp",
        userDataDir: () => "/home/.atlas",
        cacheDir: () => "/home/.cache",
        cwd: () => ROOT,
        join: (...parts: string[]) => path.posix.join(...parts),
      },
    });
    const indexer = createFileIndexingService({ database: db, files });

    expect(indexer.indexPath(`${ROOT}/data.txt`)).toBe("indexed");
    expect(indexer.indexPath(`${ROOT}/fake.txt`)).toBe("skipped");
    expect(
      indexer
        .search({ query: "detectme" })
        .some((h) => h.path.endsWith("data.txt")),
    ).toBe(true);

    db.close();
  });
});
