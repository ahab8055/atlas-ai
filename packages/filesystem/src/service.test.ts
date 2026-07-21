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
    expect(byName.map((h) => h.name).sort()).toEqual(["app.ts", "util.ts"]);
    expect(byName.every((h) => h.match === "name")).toBe(true);

    const byContent = svc.findFiles({ pattern: "atlas", content: true });
    expect(byContent.some((h) => h.match === "content")).toBe(true);
    expect(byContent.some((h) => h.name === "util.ts")).toBe(true);
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
});
