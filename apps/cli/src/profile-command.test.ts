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
import { createProfileManager } from "@atlas-ai/profile";
import { PermissionManager } from "@atlas-ai/security";

import { tryHandleProfileCommand } from "./profile-command.js";
import type { CliRuntime } from "./run.js";

function stubRuntime(): CliRuntime {
  const database = openAtlasDatabase({ path: ":memory:", skipSeed: true });
  const profile = createProfileManager(database.userPreferences, {
    observations: database.preferenceObservations,
    suggestions: database.preferenceSuggestions,
  });
  const memoryManager = createMemoryManager();
  const shortTerm = createShortTermMemory({
    maxEntries: 10,
    ttlMs: 0,
    memoryManager,
  });
  const contextManager = new ContextManager({
    conversationStore: shortTerm.toConversationStore(),
    preferenceStore: profile.asPreferenceStore(),
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
    logger: { info: () => undefined, debug: () => undefined } as never,
    config: {
      profile: {
        learning: {
          enabled: true,
          learnOnRequest: true,
          minConfidence: 0.55,
          minOccurrences: 2,
          requireApproval: true,
          autoApply: false,
        },
      },
      workspace: {
        autoDetect: false,
        rememberOnDetect: false,
      },
    } as unknown as CliRuntime["config"],
    database,
    memoryManager,
    profile,
    permissions: new PermissionManager({
      grantedCapabilities: ["memory.read", "memory.write"],
    }),
    memoryAccessLog: new MemoryAccessLog(),
  };
}

describe("profile CLI + context wiring", () => {
  it("sets and lists preferences via CLI", () => {
    const runtime = stubRuntime();
    try {
      expect(
        tryHandleProfileCommand(
          runtime,
          "profile set preferred_editor Cursor --category tools",
        ),
      ).toBe(true);
      expect(runtime.profile!.get("preferred_editor")?.value).toBe("Cursor");

      expect(tryHandleProfileCommand(runtime, "profile list")).toBe(true);
      expect(
        tryHandleProfileCommand(
          runtime,
          'profile learn "I prefer concise answers" --apply',
        ),
      ).toBe(true);
      expect(runtime.profile!.get("communication_style")?.value).toBe(
        "concise",
      );
    } finally {
      runtime.database?.close();
    }
  });

  it("suggests after repeated learn and approve persists", () => {
    const runtime = stubRuntime();
    try {
      expect(
        tryHandleProfileCommand(
          runtime,
          'profile learn "I prefer Cursor for editing"',
        ),
      ).toBe(true);
      expect(runtime.profile!.get("preferred_editor")).toBeUndefined();

      expect(
        tryHandleProfileCommand(
          runtime,
          'profile learn "I prefer Cursor for editing"',
        ),
      ).toBe(true);
      expect(tryHandleProfileCommand(runtime, "profile suggestions")).toBe(
        true,
      );
      const pending = runtime.profile!.listSuggestions({ status: "pending" });
      expect(pending.length).toBeGreaterThanOrEqual(1);
      expect(
        tryHandleProfileCommand(runtime, `profile approve ${pending[0]!.id}`),
      ).toBe(true);
      expect(runtime.profile!.get("preferred_editor")?.value).toBe("Cursor");
    } finally {
      runtime.database?.close();
    }
  });

  it("loads preferences into context across provider", () => {
    const runtime = stubRuntime();
    try {
      runtime.profile!.set("preferredEditor", "Cursor");
      runtime.profile!.set("communicationStyle", "concise");

      const request = normalizeRequest({
        source: "cli",
        rawInput: "status",
        sessionId: "pref-test",
      });
      const intent = detectIntent(request);
      const ctx = loadContext(request, intent, {
        manager: runtime.contextManager,
      });
      expect(ctx.preferences.preferredEditor).toBe("Cursor");
      expect(ctx.preferences.communicationStyle).toBe("concise");
    } finally {
      runtime.database?.close();
    }
  });
});
