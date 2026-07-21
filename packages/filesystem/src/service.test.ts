import path from "node:path";

import { describe, expect, it } from "vitest";

import { PlatformError } from "@atlas-ai/platform";

import {
  __resetDefaultFileAccessServiceForTests,
  createFileAccessService,
  createMemoryFileSystemService,
  getDefaultFileAccessService,
  setDefaultFileAccessService,
} from "./index.js";

const ROOT = "/workspace";

function buildService(
  initial: Record<string, string | null> = {
    [ROOT]: null,
    [`${ROOT}/readme.md`]: "# Hello Atlas",
    [`${ROOT}/src`]: null,
    [`${ROOT}/src/app.ts`]: "export const x = 1;",
    [`${ROOT}/src/util.ts`]: "export function util() { return 'atlas'; }",
  },
) {
  const files = createMemoryFileSystemService(initial);
  return createFileAccessService({
    files,
    roots: [ROOT],
    paths: {
      homeDir: () => "/home/test",
      tempDir: () => "/tmp",
      userDataDir: () => "/home/test/.atlas",
      cacheDir: () => "/home/test/.cache",
      cwd: () => ROOT,
      join: (...parts: string[]) => path.posix.join(...parts),
    },
  });
}

describe("FileAccessService", () => {
  it("reads, writes, mkdir, delete, and move via injected files", () => {
    const svc = buildService();

    expect(svc.readFile("readme.md").content).toContain("Hello Atlas");

    svc.writeFile("notes.txt", "note-one");
    expect(svc.readFile(`${ROOT}/notes.txt`).content).toBe("note-one");

    svc.createDirectory("docs");
    svc.writeFile("docs/a.md", "A", { createDirs: true });
    expect(svc.readFile("docs/a.md").content).toBe("A");

    svc.moveFile("notes.txt", "docs/notes.txt");
    expect(() => svc.readFile("notes.txt")).toThrow(PlatformError);
    expect(svc.readFile("docs/notes.txt").content).toBe("note-one");

    svc.deleteFile("docs/notes.txt");
    expect(() => svc.readFile("docs/notes.txt")).toThrow(PlatformError);
  });

  it("finds files by name and optional content", () => {
    const svc = buildService();

    const byName = svc.findFiles({ pattern: "*.ts" });
    expect(byName.hits.map((h) => h.name).sort()).toEqual([
      "app.ts",
      "util.ts",
    ]);
    expect(byName.hits.every((h) => h.match === "name")).toBe(true);
    expect(byName.hits.every((h) => h.isFile)).toBe(true);
    expect(byName.hits.every((h) => h.extension === ".ts")).toBe(true);
    expect(byName.scannedEntries).toBeGreaterThan(0);
    expect(typeof byName.durationMs).toBe("number");

    const byContent = svc.findFiles({ pattern: "atlas", content: true });
    expect(byContent.hits.some((h) => h.match === "content")).toBe(true);
    expect(byContent.hits.some((h) => h.name === "util.ts")).toBe(true);
  });

  it("supports extension filters, ? wildcards, hidden, depth, and truncate", () => {
    const svc = buildService({
      [ROOT]: null,
      [`${ROOT}/a.ts`]: "a",
      [`${ROOT}/b.md`]: "b",
      [`${ROOT}/c.tsx`]: "c",
      [`${ROOT}/note1.txt`]: "x",
      [`${ROOT}/note2.txt`]: "y",
      [`${ROOT}/.secret`]: "no",
      [`${ROOT}/deep`]: null,
      [`${ROOT}/deep/nested`]: null,
      [`${ROOT}/deep/nested/far.ts`]: "far",
    });

    const ext = svc.findFiles({ pattern: "*", extensions: [".ts", "tsx"] });
    expect(ext.hits.map((h) => h.name).sort()).toEqual([
      "a.ts",
      "c.tsx",
      "far.ts",
    ]);

    const wild = svc.findFiles({ pattern: "note?.txt" });
    expect(wild.hits.map((h) => h.name).sort()).toEqual([
      "note1.txt",
      "note2.txt",
    ]);

    const noHidden = svc.findFiles({ pattern: "*" });
    expect(noHidden.hits.some((h) => h.name === ".secret")).toBe(false);

    const withHidden = svc.findFiles({
      pattern: "*",
      includeHidden: true,
      filesOnly: true,
    });
    expect(withHidden.hits.some((h) => h.name === ".secret")).toBe(true);

    const shallow = svc.findFiles({ pattern: "*.ts", maxDepth: 0 });
    expect(shallow.hits.map((h) => h.name)).toEqual(["a.ts"]);
    expect(shallow.hits.some((h) => h.name === "far.ts")).toBe(false);

    const limited = svc.findFiles({ pattern: "*", limit: 2 });
    expect(limited.hits).toHaveLength(2);
    expect(limited.truncated).toBe(true);
  });

  it("rejects path escape outside roots", () => {
    const svc = buildService();
    expect(() => svc.readFile("/etc/passwd")).toThrow(PlatformError);
    try {
      svc.readFile("../outside.txt");
    } catch (error) {
      expect(error).toBeInstanceOf(PlatformError);
      expect((error as PlatformError).code).toBe("permission_denied");
    }
  });

  it("denies sensitive paths and basenames", () => {
    const svc = buildService({
      [ROOT]: null,
      [`${ROOT}/.ssh`]: null,
      [`${ROOT}/.ssh/id_rsa`]: "secret",
      [`${ROOT}/ok.txt`]: "fine",
    });

    expect(() => svc.readFile(".ssh/id_rsa")).toThrow(/denied|sensitive/i);
    expect(svc.readFile("ok.txt").content).toBe("fine");
  });

  it("supports default singleton set/get/reset", () => {
    __resetDefaultFileAccessServiceForTests();
    expect(() => getDefaultFileAccessService()).toThrow(/not bootstrapped/);
    const svc = buildService();
    setDefaultFileAccessService(svc);
    expect(getDefaultFileAccessService()).toBe(svc);
    __resetDefaultFileAccessServiceForTests();
  });

  it("refuses overwrite when overwrite: false", () => {
    const svc = buildService();
    expect(() => svc.writeFile("readme.md", "x", { overwrite: false })).toThrow(
      /already exists/,
    );
  });

  it("resolves relative and absolute paths within roots", () => {
    const svc = buildService();
    expect(svc.resolvePath("src/app.ts")).toBe(`${ROOT}/src/app.ts`);
    expect(svc.resolvePath(`${ROOT}/readme.md`)).toBe(`${ROOT}/readme.md`);
    expect(() => svc.resolvePath("/etc/passwd")).toThrow(PlatformError);
  });

  it("lists and walks directories; reports symlinks without following by default", () => {
    const files = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/src`]: null,
      [`${ROOT}/src/app.ts`]: "x",
      [`${ROOT}/.hidden`]: "secret",
      [`${ROOT}/nested`]: null,
      [`${ROOT}/nested/deep.txt`]: "d",
    });
    files.symlink(`${ROOT}/link-to-src`, "src");

    const svc = createFileAccessService({
      files,
      roots: [ROOT],
      paths: {
        homeDir: () => "/home/test",
        tempDir: () => "/tmp",
        userDataDir: () => "/home/test/.atlas",
        cacheDir: () => "/home/test/.cache",
        cwd: () => ROOT,
        join: (...parts: string[]) => path.posix.join(...parts),
      },
    });

    const listed = svc.listDirectory();
    expect(listed.map((e) => e.name).sort()).toEqual([
      "link-to-src",
      "nested",
      "src",
    ]);
    const link = listed.find((e) => e.name === "link-to-src");
    expect(link?.isSymbolicLink).toBe(true);
    expect(link?.linkTarget).toBe("src");

    const withHidden = svc.listDirectory(undefined, { includeHidden: true });
    expect(withHidden.some((e) => e.name === ".hidden")).toBe(true);

    const walked = svc.walkDirectory(undefined, { maxDepth: 8 });
    expect(walked.some((e) => e.name === "app.ts")).toBe(true);
    expect(walked.some((e) => e.name === "deep.txt")).toBe(true);
    expect(walked.filter((e) => e.path.includes("link-to-src/")).length).toBe(
      0,
    );

    const followed = svc.walkDirectory(undefined, {
      followSymlinks: true,
      maxDepth: 8,
    });
    expect(followed.some((e) => e.name === "app.ts")).toBe(true);
  });

  it("returns unified file metadata with mime and checksum", () => {
    const svc = buildService({
      [ROOT]: null,
      [`${ROOT}/hello.txt`]: "hello atlas",
      [`${ROOT}/docs`]: null,
    });

    const meta = svc.getFileMetadata("hello.txt");
    expect(meta.name).toBe("hello.txt");
    expect(meta.extension).toBe(".txt");
    expect(meta.mimeType).toBe("text/plain");
    expect(meta.size).toBe(Buffer.byteLength("hello atlas", "utf8"));
    expect(meta.isFile).toBe(true);
    expect(meta.permissions).toMatch(/^[rwx-]{9}$/);
    expect(typeof meta.createdAtMs).toBe("number");
    expect(typeof meta.modifiedAtMs).toBe("number");
    expect(meta.owner.uid).toBeDefined();
    expect(meta.checksum?.algorithm).toBe("sha256");
    expect(meta.checksum?.hex).toHaveLength(64);

    const dirMeta = svc.getFileMetadata("docs");
    expect(dirMeta.isDirectory).toBe(true);
    expect(dirMeta.mimeType).toBe("inode/directory");
    expect(dirMeta.checksumSkipped).toMatch(/not a regular file/);

    const noHash = svc.getFileMetadata("hello.txt", {
      includeChecksum: false,
    });
    expect(noHash.checksum).toBeUndefined();
    expect(noHash.checksumSkipped).toBe("checksum disabled");
  });
});
