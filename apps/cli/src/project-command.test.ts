import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ContextManager,
  detectIntent,
  loadContext,
  normalizeRequest,
} from "@atlas-ai/core";
import { openAtlasDatabase } from "@atlas-ai/database";
import {
  createMemoryManager,
  createShortTermMemory,
  MemoryAccessLog,
} from "@atlas-ai/memory";
import { PermissionManager } from "@atlas-ai/security";
import { createWorkspaceManager } from "@atlas-ai/workspace";

import { tryHandleProjectCommand } from "./project-command.js";
import type { CliRuntime } from "./run.js";

function stubRuntime(cwd?: string): CliRuntime {
  const database = openAtlasDatabase({ path: ":memory:" });
  const workspace = createWorkspaceManager(
    database.projects,
    database.userPreferences,
  );
  if (cwd) {
    workspace.detectAndRegister({ cwd, remember: true });
  }
  const memoryManager = createMemoryManager();
  const shortTerm = createShortTermMemory({
    maxEntries: 10,
    ttlMs: 0,
    memoryManager,
  });
  const contextManager = new ContextManager({
    conversationStore: shortTerm.toConversationStore(),
    projectLoader: () => workspace.getActiveContext(),
  });

  return {
    handler: {
      handle: () => {
        throw new Error("unused");
      },
    } as unknown as CliRuntime["handler"],
    eventBus: {
      subscribe: () => () => undefined,
    } as unknown as CliRuntime["eventBus"],
    contextManager,
    logger: { info: () => undefined } as never,
    config: {
      workspace: { autoDetect: false, rememberOnDetect: true },
    } as unknown as CliRuntime["config"],
    database,
    memoryManager,
    workspace,
    permissions: new PermissionManager({
      grantedCapabilities: ["memory.read", "memory.write"],
    }),
    memoryAccessLog: new MemoryAccessLog(),
  };
}

describe("project CLI + context wiring", () => {
  it("detects and activates a project folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "atlas-proj-cli-"));
    const runtime = stubRuntime();
    try {
      writeFileSync(join(dir, "package.json"), "{}");
      expect(
        tryHandleProjectCommand(runtime, `project detect --cwd ${dir}`),
      ).toBe(true);
      expect(runtime.workspace!.getActive()?.path).toBe(dir);
      expect(tryHandleProjectCommand(runtime, "project status")).toBe(true);
      expect(tryHandleProjectCommand(runtime, "project list")).toBe(true);
    } finally {
      runtime.database?.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads active project into context automatically", () => {
    const dir = mkdtempSync(join(tmpdir(), "atlas-proj-ctx-"));
    writeFileSync(join(dir, "package.json"), "{}");
    const runtime = stubRuntime(dir);
    try {
      const request = normalizeRequest({
        source: "cli",
        rawInput: "status",
        sessionId: "proj-test",
      });
      const intent = detectIntent(request);
      const ctx = loadContext(request, intent, {
        manager: runtime.contextManager,
      });
      expect(ctx.project?.path).toBe(dir);
      expect(ctx.project?.name).toBeTruthy();
    } finally {
      runtime.database?.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
