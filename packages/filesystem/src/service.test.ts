import path from "node:path";

import { describe, expect, it } from "vitest";

import { PlatformError } from "@atlas-ai/platform";
import { PermissionManager } from "@atlas-ai/security";

import {
  __resetDefaultFileAccessServiceForTests,
  createFileAccessService,
  createMemoryFileSystemService,
  getDefaultFileAccessService,
  isFileSystemError,
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

  it("skips ignored paths in search/walk and still allows explicit read", () => {
    const files = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/.gitignore`]: "secret.txt\n",
      [`${ROOT}/app.ts`]: "export {}",
      [`${ROOT}/secret.txt`]: "nope",
      [`${ROOT}/node_modules`]: null,
      [`${ROOT}/node_modules/pkg`]: null,
      [`${ROOT}/node_modules/pkg/index.js`]: "module.exports=1",
      [`${ROOT}/scratch.tmp`]: "tmp",
    });
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

    const found = svc.findFiles({ pattern: "*" });
    expect(found.hits.map((h) => h.name).sort()).toEqual(["app.ts"]);
    expect(found.hits.some((h) => h.name === "index.js")).toBe(false);
    expect(found.hits.some((h) => h.name === "secret.txt")).toBe(false);
    expect(found.hits.some((h) => h.name === "scratch.tmp")).toBe(false);

    const withRespectOff = svc.findFiles({
      pattern: "*",
      respectIgnore: false,
      includeHidden: true,
    });
    expect(withRespectOff.hits.some((h) => h.name === "index.js")).toBe(true);
    expect(withRespectOff.hits.some((h) => h.name === "secret.txt")).toBe(true);

    const walked = svc.walkDirectory(".", { maxDepth: 4 });
    expect(walked.some((e) => e.name === "node_modules")).toBe(false);
    expect(walked.some((e) => e.name === "app.ts")).toBe(true);

    expect(svc.readFile("secret.txt").content).toBe("nope");
    expect(svc.readFile("node_modules/pkg/index.js").content).toContain(
      "module.exports",
    );
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

  it("reads structured content with format, encoding, and parsers", () => {
    const svc = buildService({
      [ROOT]: null,
      [`${ROOT}/data.json`]: '{"a":1,"b":[true]}',
      [`${ROOT}/config.yaml`]: "name: atlas\ncount: 2\n",
      [`${ROOT}/rows.csv`]: "a,b\n1,2\n",
      [`${ROOT}/note.md`]: "# Title\n\nHello",
      [`${ROOT}/photo.png`]: "not-really-png",
    });

    const json = svc.readFile("data.json");
    expect(json.format).toBe("json");
    expect(json.encoding).toBe("utf-8");
    expect(json.data).toEqual({ a: 1, b: [true] });
    expect(json.truncated).toBe(false);

    const yaml = svc.readFile("config.yaml");
    expect(yaml.format).toBe("yaml");
    expect(yaml.data).toEqual({ name: "atlas", count: 2 });

    const csv = svc.readFile("rows.csv");
    expect(csv.format).toBe("csv");
    expect(csv.data).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);

    const md = svc.readFile("note.md");
    expect(md.format).toBe("markdown");
    expect(md.content).toContain("# Title");
    expect(md.data).toBeUndefined();

    expect(() => svc.readFile("photo.png")).toThrow(PlatformError);
  });

  it("returns standardized FileSystemError kinds for missing and unsupported", () => {
    const svc = buildService({
      [ROOT]: null,
      [`${ROOT}/photo.png`]: "not-really-png",
    });

    try {
      svc.readFile("missing.txt");
      expect.unreachable();
    } catch (error) {
      expect(isFileSystemError(error)).toBe(true);
      if (isFileSystemError(error)) {
        expect(error.kind).toBe("file_not_found");
        expect(error.code).toBe("resource_not_found");
      }
    }

    try {
      svc.readFile("photo.png");
      expect.unreachable();
    } catch (error) {
      expect(isFileSystemError(error)).toBe(true);
      if (isFileSystemError(error)) {
        expect(error.kind).toBe("unsupported_type");
        expect(error.code).toBe("unsupported");
      }
    }
  });

  it("detects type from content when extension is wrong", () => {
    const mem = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/secret.txt`]: '{"hello":"world"}',
      [`${ROOT}/ok.png`]: "",
      [`${ROOT}/plain.txt`]: "",
    });
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    mem.writeBytes(`${ROOT}/plain.txt`, png);
    mem.writeBytes(`${ROOT}/ok.png`, png);

    const svc = createFileAccessService({
      files: mem,
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

    const json = svc.readFile("secret.txt");
    expect(json.format).toBe("json");
    expect(json.mimeType).toBe("application/json");
    expect(json.extensionMismatch).toBe(true);
    expect(json.data).toEqual({ hello: "world" });

    expect(() => svc.readFile("plain.txt")).toThrow(PlatformError);

    const detected = svc.detectFileType("plain.txt");
    expect(detected.format).toBe("binary");
    expect(detected.mimeType).toBe("image/png");
    expect(detected.processor).toBe("reject.binary");
    expect(detected.extensionMismatch).toBe(true);

    const matched = svc.detectFileType("ok.png");
    expect(matched.mimeType).toBe("image/png");
    expect(matched.extensionMismatch).toBe(false);

    const meta = svc.getFileMetadata("plain.txt", { includeChecksum: false });
    expect(meta.mimeType).toBe("image/png");
    expect(meta.format).toBe("binary");
    expect(meta.extensionMismatch).toBe(true);
  });

  it("windows large files with offset/maxBytes and truncated flag", () => {
    const body = "abcdefghijklmnopqrstuvwxyz";
    const svc = buildService({
      [ROOT]: null,
      [`${ROOT}/big.txt`]: body,
    });
    const part = svc.readFile("big.txt", { offset: 10, maxBytes: 5 });
    expect(part.content).toBe("klmno");
    expect(part.byteOffset).toBe(10);
    expect(part.byteLength).toBe(5);
    expect(part.truncated).toBe(true);
    expect(part.size).toBe(body.length);
    expect(part.parseError).toBe("parse skipped: content truncated");
  });

  it("streams large files via readFileChunks without loading whole file", () => {
    const body = "abcdefghijklmnopqrstuvwxyz0123456789";
    const svc = createFileAccessService({
      files: createMemoryFileSystemService({
        [ROOT]: null,
        [`${ROOT}/huge.txt`]: body,
      }),
      roots: [ROOT],
      maxChunkBytes: 8,
      maxReadBytes: 8,
      paths: {
        homeDir: () => "/home/test",
        tempDir: () => "/tmp",
        userDataDir: () => "/home/test/.atlas",
        cacheDir: () => "/home/test/.cache",
        cwd: () => ROOT,
        join: (...parts: string[]) => path.posix.join(...parts),
      },
    });

    const chunks = [...svc.readFileChunks("huge.txt", { chunkSize: 8 })];
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.content).join("")).toBe(body);
    expect(chunks[0]?.byteOffset).toBe(0);
    expect(chunks[1]?.byteOffset).toBe(8);
    expect(chunks.at(-1)?.eof).toBe(true);
    expect(chunks.slice(0, -1).every((c) => c.truncated && !c.eof)).toBe(true);

    const budgeted = [
      ...svc.readFileChunks("huge.txt", { chunkSize: 8, maxBytes: 16 }),
    ];
    expect(budgeted).toHaveLength(2);
    expect(budgeted.at(-1)?.truncated).toBe(true);
    expect(budgeted.at(-1)?.eof).toBe(false);

    expect(() => [
      ...svc.readFileChunks("huge.txt", { chunkSize: 64 }),
    ]).toThrow(PlatformError);

    const walked = svc.forEachFileChunk("huge.txt", () => {}, {
      chunkSize: 8,
    });
    expect(walked.chunks).toBe(5);
    expect(walked.bytesRead).toBe(body.length);
  });

  it("writes with create, overwrite, append, and atomic modes", () => {
    const svc = buildService({ [ROOT]: null });

    const created = svc.writeFile("out.txt", "hello", { mode: "create" });
    expect(created.created).toBe(true);
    expect(created.mode).toBe("create");
    expect(created.atomic).toBe(true);
    expect(created.encoding).toBe("utf-8");
    expect(created.bytesWritten).toBeGreaterThan(0);
    expect(svc.readFile("out.txt").content).toBe("hello");

    expect(() => svc.writeFile("out.txt", "nope", { mode: "create" })).toThrow(
      PlatformError,
    );

    const over = svc.writeFile("out.txt", "world", { mode: "overwrite" });
    expect(over.created).toBe(false);
    expect(svc.readFile("out.txt").content).toBe("world");

    const appended = svc.writeFile("out.txt", "!", {
      mode: "append",
      atomic: false,
    });
    expect(appended.mode).toBe("append");
    expect(appended.atomic).toBe(false);
    expect(svc.readFile("out.txt").content).toBe("world!");

    const atomicAppend = svc.writeFile("out.txt", "?", {
      mode: "append",
      atomic: true,
    });
    expect(atomicAppend.atomic).toBe(true);
    expect(svc.readFile("out.txt").content).toBe("world!?");

    expect(() => svc.writeFile("out.txt", "x", { overwrite: false })).toThrow(
      PlatformError,
    );
  });

  it("manages directories: create, exists, move, empty delete", () => {
    const svc = buildService({
      [ROOT]: null,
      [`${ROOT}/src`]: null,
      [`${ROOT}/src/app.ts`]: "export const x = 1;",
    });

    expect(svc.directoryExists("src")).toBe(true);
    expect(svc.directoryExists("missing")).toBe(false);
    expect(svc.pathExists("src/app.ts")).toEqual({
      exists: true,
      isFile: true,
      isDirectory: false,
    });

    const mkdir = svc.createDirectory("docs");
    expect(mkdir.created).toBe(true);
    expect(svc.createDirectory("docs").created).toBe(false);

    const moved = svc.movePath("src", "lib");
    expect(moved.kind).toBe("directory");
    expect(svc.directoryExists("src")).toBe(false);
    expect(svc.directoryExists("lib")).toBe(true);
    expect(svc.readFile("lib/app.ts").content).toContain("export const x");

    expect(() => svc.deleteDirectory("lib")).toThrow(PlatformError);
    svc.deleteFile("lib/app.ts");
    svc.deleteDirectory("lib");
    expect(svc.directoryExists("lib")).toBe(false);

    expect(() => svc.movePath("docs", `${ROOT}/docs/nested`)).toThrow(
      PlatformError,
    );
  });

  it("copies, trashes, and restores files", () => {
    const svc = buildService({
      [ROOT]: null,
      [`${ROOT}/a.txt`]: "alpha",
      [`${ROOT}/src`]: null,
      [`${ROOT}/src/b.txt`]: "beta",
    });

    const copied = svc.copyPath("a.txt", "a-copy.txt");
    expect(copied.kind).toBe("file");
    expect(copied.overwritten).toBe(false);
    expect(svc.readFile("a-copy.txt").content).toBe("alpha");

    const dirCopy = svc.copyPath("src", "src2");
    expect(dirCopy.kind).toBe("directory");
    expect(svc.readFile("src2/b.txt").content).toBe("beta");

    expect(() => svc.copyPath("a.txt", "a-copy.txt")).toThrow(PlatformError);

    const trashed = svc.deletePath("a.txt");
    expect(trashed.mode).toBe("trash");
    expect(trashed.restorable).toBe(true);
    expect(trashed.trashId).toBeTruthy();
    expect(svc.pathExists("a.txt").exists).toBe(false);

    const restored = svc.restorePath(trashed.trashId!);
    expect(restored.path).toBe(`${ROOT}/a.txt`);
    expect(svc.readFile("a.txt").content).toBe("alpha");

    const hard = svc.deletePath("a-copy.txt", { trash: false });
    expect(hard.mode).toBe("hard");
    expect(hard.restorable).toBe(false);
    expect(svc.pathExists("a-copy.txt").exists).toBe(false);

    const renamed = svc.renamePath("src2", "src3");
    expect(renamed.kind).toBe("directory");
    expect(svc.directoryExists("src3")).toBe(true);
  });

  it("blocks write/copy when PermissionManager lacks filesystem.write", () => {
    const permissions = new PermissionManager({
      grantedCapabilities: ["filesystem.read"],
    });
    const files = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/a.txt`]: "hi",
    });
    const svc = createFileAccessService({
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

    expect(() => svc.writeFile("b.txt", "x")).toThrow(PlatformError);
    try {
      svc.writeFile("b.txt", "x");
    } catch (error) {
      expect((error as PlatformError).code).toBe("permission_denied");
    }

    expect(() => svc.copyPath("a.txt", "c.txt")).toThrow(PlatformError);

    // Read still allowed
    expect(svc.readFile("a.txt").content).toBe("hi");

    // Path outside roots denied even with write grant
    permissions.grant("filesystem.write");
    permissions.grant("filesystem.delete");
    expect(() => svc.readFile("/etc/passwd")).toThrow(PlatformError);
  });

  it("invokes onAccess after successful read/write and skips on authorize failure", () => {
    const accessEvents: Array<{ path: string; action: "read" | "write" }> = [];
    const gone: string[] = [];
    const permissions = new PermissionManager({
      grantedCapabilities: ["filesystem.read"],
    });
    const files = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/a.txt`]: "hi",
    });
    const svc = createFileAccessService({
      files,
      roots: [ROOT],
      permissions,
      onAccess: (e) => {
        accessEvents.push({ path: e.path, action: e.action });
      },
      onPathGone: (p) => {
        gone.push(p);
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

    expect(svc.readFile("a.txt").content).toBe("hi");
    expect(accessEvents).toEqual([{ path: `${ROOT}/a.txt`, action: "read" }]);

    expect(() => svc.writeFile("b.txt", "x")).toThrow(PlatformError);
    expect(accessEvents).toHaveLength(1);

    permissions.grant("filesystem.write");
    permissions.grant("filesystem.delete");
    svc.writeFile("b.txt", "x");
    expect(accessEvents.at(-1)).toEqual({
      path: `${ROOT}/b.txt`,
      action: "write",
    });

    svc.deletePath("b.txt", { trash: false });
    expect(gone).toContain(`${ROOT}/b.txt`);
  });

  it("one-shot approve allows destructive overwrite with trash backup", () => {
    const permissions = new PermissionManager({
      grantedCapabilities: ["filesystem.read"],
    });
    const files = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/a.txt`]: "old",
      [`${ROOT}/b.txt`]: "keep",
    });
    const svc = createFileAccessService({
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

    let approvalId: string | undefined;
    try {
      svc.writeFile("a.txt", "new", { mode: "overwrite" });
    } catch (error) {
      expect(error).toBeInstanceOf(PlatformError);
      expect((error as PlatformError).code).toBe("permission_denied");
      approvalId = (error as PlatformError).approvalId;
    }
    expect(approvalId).toBeTruthy();

    permissions.resolveApproval(approvalId!, "approved", {
      sessionGrant: false,
    });

    const written = svc.writeFile("a.txt", "new", { mode: "overwrite" });
    expect(written.backedUp).toBe(true);
    expect(written.backupId).toBeTruthy();
    expect(svc.readFile("a.txt").content).toBe("new");

    // One-shot consumed — next overwrite blocks again
    expect(() =>
      svc.writeFile("a.txt", "newer", { mode: "overwrite" }),
    ).toThrow(PlatformError);

    // Copy overwrite also backs up destination
    let copyApproval: string | undefined;
    try {
      svc.copyPath("b.txt", "a.txt", { overwrite: true });
    } catch (error) {
      copyApproval = (error as PlatformError).approvalId;
    }
    expect(copyApproval).toBeTruthy();
    permissions.resolveApproval(copyApproval!, "approved", {
      sessionGrant: false,
    });
    const copied = svc.copyPath("b.txt", "a.txt", { overwrite: true });
    expect(copied.overwritten).toBe(true);
    expect(copied.backupId).toBeTruthy();
    expect(svc.readFile("a.txt").content).toBe("keep");

    // Restore overwrite backup of prior "new" after clearing target
    let delApproval: string | undefined;
    try {
      svc.deletePath("a.txt", { trash: false });
    } catch (error) {
      delApproval = (error as PlatformError).approvalId;
    }
    permissions.resolveApproval(delApproval!, "approved", {
      sessionGrant: false,
    });
    svc.deletePath("a.txt", { trash: false });

    let restoreApproval: string | undefined;
    try {
      svc.restorePath(copied.backupId!);
    } catch (error) {
      restoreApproval = (error as PlatformError).approvalId;
    }
    permissions.resolveApproval(restoreApproval!, "approved", {
      sessionGrant: false,
    });
    const restored = svc.restorePath(copied.backupId!);
    expect(restored.path).toBe(`${ROOT}/a.txt`);
    expect(svc.readFile("a.txt").content).toBe("new");
  });
});
