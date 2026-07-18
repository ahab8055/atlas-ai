import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";

import { createWorkspaceManager, detectProjectRoot } from "./index.js";

describe("detectProjectRoot", () => {
  it("finds git root and reads origin url", () => {
    const dir = mkdtempSync(join(tmpdir(), "atlas-ws-"));
    try {
      mkdirSync(join(dir, ".git"));
      writeFileSync(
        join(dir, ".git", "config"),
        '[remote "origin"]\n\turl = https://github.com/example/demo.git\n',
      );
      writeFileSync(join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");
      const nested = join(dir, "packages", "app");
      mkdirSync(nested, { recursive: true });

      const hit = detectProjectRoot(nested);
      expect(hit?.kind).toBe("git");
      expect(hit?.rootPath).toBe(dir);
      expect(hit?.repoUrl).toContain("github.com/example/demo");
      expect(hit?.defaultBranch).toBe("main");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("finds package.json marker when no git", () => {
    const dir = mkdtempSync(join(tmpdir(), "atlas-ws-pkg-"));
    try {
      writeFileSync(join(dir, "package.json"), "{}");
      const hit = detectProjectRoot(dir);
      expect(hit?.kind).toBe("marker");
      expect(hit?.marker).toBe("package.json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("WorkspaceManager", () => {
  it("registers detected project and sets active", () => {
    const dir = mkdtempSync(join(tmpdir(), "atlas-ws-mgr-"));
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      writeFileSync(join(dir, "package.json"), '{"name":"demo"}');
      const ws = createWorkspaceManager(db.projects, db.userPreferences);
      const row = ws.detectAndRegister({ cwd: dir });
      expect(row?.path).toBe(dir);
      expect(ws.getActive()?.id).toBe(row?.id);
      expect(ws.getActiveContext()?.path).toBe(dir);
      expect(db.userPreferences.get("active_project_id")).toBe(row?.id);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
