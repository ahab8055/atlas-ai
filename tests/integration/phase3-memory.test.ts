/**
 * Phase 3 Memory & Personal Context — integration tests.
 *
 * Cross-package workflows (not colocated unit tests):
 * storage · retrieval/context · consolidation · knowledge · profile ·
 * workspace · backup · short-term · critical path.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { detectIntent, loadContext, normalizeRequest } from "@atlas-ai/core";
import {
  decryptBackup,
  encryptBackup,
  validateSnapshot,
} from "@atlas-ai/memory";

import { createMemoryHarness } from "./memory-helpers.js";

describe("Phase 3 integration — memory storage & updates", () => {
  it("stores, updates, and reads back memories including sensitive rows", () => {
    const harness = createMemoryHarness();
    try {
      const row = harness.longTermMemory.store({
        type: "semantic",
        content: "Prefers TypeScript for Atlas CLI",
        importance: 0.9,
        confidence: 0.9,
      });
      expect(row.id).toBeTruthy();
      expect(harness.longTermMemory.get(row.id)?.content).toContain(
        "TypeScript",
      );

      const updated = harness.longTermMemory.update(row.id, {
        content: "Prefers TypeScript strictly for Atlas CLI",
        importance: 0.95,
      });
      expect(updated?.content).toContain("strictly");
      expect(harness.longTermMemory.list({ type: "semantic" }).length).toBe(1);

      const sensitive = harness.longTermMemory.store({
        type: "semantic",
        content: "private medical note for diagnostics",
        sensitivity: "sensitive",
      });
      expect(sensitive.encrypted).toBe(true);
      expect(harness.longTermMemory.get(sensitive.id)?.content).toContain(
        "medical",
      );
      const raw = harness.database.memories.get(sensitive.id)!;
      expect(raw.content).not.toContain("medical");

      const classified = harness.longTermMemory.evaluateAndStore(
        "I always prefer dark mode interfaces when coding",
        {
          thresholds: {
            minImportanceToStore: 0.3,
            minConfidenceToStore: 0.3,
            temporaryTtlMs: 86_400_000,
          },
        },
      );
      expect(classified.stored).toBe(true);
      expect(harness.longTermMemory.list().length).toBeGreaterThanOrEqual(2);
    } finally {
      harness.cleanup();
    }
  });
});

describe("Phase 3 integration — retrieval & context", () => {
  it("retrieves ranked memories and injects them into LoadedContext", () => {
    const harness = createMemoryHarness({
      retrieval: { minScore: 0.05, limit: 5 },
    });
    try {
      harness.longTermMemory.store({
        type: "semantic",
        content: "User prefers dark mode interfaces",
        importance: 0.9,
        confidence: 0.9,
      });

      const hits = harness.longTermMemory.retrieve("change theme to dark", {
        minScore: 0.05,
      });
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]!.record.content).toContain("dark mode");

      const search = harness.longTermMemory.searchMemories({
        query: "dark mode",
        mode: "hybrid",
        minScore: 0.05,
      });
      expect(search.hits.length).toBeGreaterThan(0);
      expect(search.tookMs).toBeGreaterThanOrEqual(0);

      const request = normalizeRequest({
        source: "cli",
        rawInput: "change theme to dark mode",
        sessionId: "p3-mem-ctx",
      });
      const intent = detectIntent(request);
      const context = loadContext(request, intent, {
        manager: harness.contextManager,
      });
      expect(context.memories.length).toBeGreaterThan(0);
      expect(context.memories[0]?.content).toContain("dark mode");
      expect(context.sources).toContain("memory");
    } finally {
      harness.cleanup();
    }
  });
});

describe("Phase 3 integration — consolidation", () => {
  it("merges near-duplicates and flags conflicts with openConflicts stats", () => {
    const harness = createMemoryHarness();
    try {
      harness.longTermMemory.store({
        type: "semantic",
        content: "Prefers TypeScript strictly",
        importance: 0.9,
      });
      harness.longTermMemory.store({
        type: "semantic",
        content: "Prefers TypeScript strictly",
        importance: 0.8,
      });
      const merged = harness.longTermMemory.consolidate({ type: "semantic" });
      expect(merged.merged).toBeGreaterThanOrEqual(1);
      expect(harness.longTermMemory.list().length).toBe(1);
      expect(harness.longTermMemory.getMetrics().merged).toBeGreaterThanOrEqual(
        1,
      );

      harness.longTermMemory.store({
        type: "semantic",
        content: "User prefers dark mode",
        importance: 0.9,
      });
      harness.longTermMemory.store({
        type: "semantic",
        content: "User prefers light mode",
        importance: 0.9,
      });
      const conflicts = harness.longTermMemory.consolidate();
      expect(conflicts.conflicts).toBeGreaterThanOrEqual(1);
      expect(harness.longTermMemory.listConflicts().length).toBeGreaterThan(0);
      expect(harness.longTermMemory.getStats().openConflicts).toBeGreaterThan(
        0,
      );
    } finally {
      harness.cleanup();
    }
  });
});

describe("Phase 3 integration — knowledge graph", () => {
  it("extracts, links, retrieves, and injects knowledge into context", () => {
    const harness = createMemoryHarness({
      knowledgeRetrieval: { minScore: 0.05, limit: 8 },
    });
    try {
      const extracted = harness.knowledgeGraph.extractAndStore(
        "Working on project Atlas with TypeScript and React",
      );
      expect(extracted.stored.length).toBeGreaterThanOrEqual(1);

      const projects = harness.knowledgeGraph.listEntities({
        type: "project",
      });
      const techs = harness.knowledgeGraph.listEntities({
        type: "technology",
      });
      expect(projects.length + techs.length).toBeGreaterThan(0);

      if (projects[0] && techs[0]) {
        harness.knowledgeGraph.linkEntities({
          from: { id: projects[0].id },
          to: { id: techs[0].id },
          type: "uses",
        });
      }

      const snippets = harness.knowledgeGraph.retrieve("Atlas TypeScript", {
        minScore: 0.05,
        limit: 8,
      });
      expect(snippets.length).toBeGreaterThan(0);

      const request = normalizeRequest({
        source: "cli",
        rawInput: "tell me about Atlas TypeScript",
        sessionId: "p3-kg-ctx",
      });
      const intent = detectIntent(request);
      const context = loadContext(request, intent, {
        manager: harness.contextManager,
      });
      expect(context.knowledge.length).toBeGreaterThan(0);
      expect(context.sources).toContain("knowledge");
    } finally {
      harness.cleanup();
    }
  });
});

describe("Phase 3 integration — personalization", () => {
  it("sets preferences and loads them into context after learn/approve", () => {
    const harness = createMemoryHarness();
    try {
      harness.profile.set("preferred_editor", "Cursor", {
        source: "explicit",
        confidence: 1,
      });
      harness.profile.set("communication_style", "concise", {
        source: "explicit",
        confidence: 1,
      });

      const request = normalizeRequest({
        source: "cli",
        rawInput: "status",
        sessionId: "p3-profile",
      });
      const intent = detectIntent(request);
      const ctx = loadContext(request, intent, {
        manager: harness.contextManager,
      });
      expect(ctx.preferences.preferredEditor).toBe("Cursor");
      expect(ctx.preferences.communicationStyle).toBe("concise");

      harness.profile.observeFromText("I prefer Neovim for editing", {
        minOccurrences: 2,
      });
      const second = harness.profile.observeFromText(
        "I prefer Neovim for editing",
        { minOccurrences: 2 },
      );
      expect(second.suggestionsCreated.length).toBeGreaterThanOrEqual(1);
      const pending = harness.profile.listSuggestions({ status: "pending" });
      expect(pending.length).toBeGreaterThanOrEqual(1);
      harness.profile.approveSuggestion(pending[0]!.id);
      expect(harness.profile.get("preferred_editor")?.value).toBe("Neovim");
    } finally {
      harness.cleanup();
    }
  });
});

describe("Phase 3 integration — workspace scoping", () => {
  it("scopes memory search to the active project", () => {
    const dir = mkdtempSync(join(tmpdir(), "atlas-p3-ws-"));
    const harness = createMemoryHarness({
      retrieval: { minScore: 0.05 },
    });
    try {
      writeFileSync(join(dir, "package.json"), '{"name":"demo-p3"}');
      const project = harness.workspace.detectAndRegister({ cwd: dir });
      expect(project?.id).toBeTruthy();
      harness.refreshContext();

      harness.longTermMemory.store({
        type: "semantic",
        content: "Project-scoped note about demo-p3 TypeScript stack",
        importance: 0.9,
        projectId: project!.id,
      });
      harness.longTermMemory.store({
        type: "semantic",
        content: "Unscoped note about gardening hobbies",
        importance: 0.9,
      });

      const scoped = harness.longTermMemory.searchMemories({
        query: "TypeScript",
        projectId: project!.id,
        minScore: 0.05,
      });
      expect(
        scoped.hits.every(
          (h) =>
            h.record.projectId === project!.id || h.record.projectId == null,
        ),
      ).toBe(true);
      expect(
        scoped.hits.some((h) => h.record.content.includes("demo-p3")),
      ).toBe(true);

      const ctxReq = normalizeRequest({
        source: "cli",
        rawInput: "demo-p3 TypeScript",
        sessionId: "p3-ws",
      });
      const ctx = loadContext(ctxReq, detectIntent(ctxReq), {
        manager: harness.contextManager,
      });
      expect(ctx.project?.path).toBe(dir);
    } finally {
      harness.cleanup();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Phase 3 integration — backup workflow", () => {
  it("exports, clears, imports, and round-trips encrypted envelopes", () => {
    const harness = createMemoryHarness();
    try {
      harness.longTermMemory.store({
        type: "semantic",
        content: "Backup probe prefers TypeScript",
        importance: 0.9,
      });
      harness.longTermMemory.store({
        type: "semantic",
        content: "sensitive backup note",
        sensitivity: "sensitive",
      });

      const snap = harness.longTermMemory.exportBackup();
      expect(snap.count).toBe(2);
      expect(validateSnapshot(snap).ok).toBe(true);

      const envelope = encryptBackup(snap, "phase3-backup-pass");
      const restoredSnap = decryptBackup(envelope, "phase3-backup-pass");
      expect(restoredSnap.count).toBe(2);

      harness.longTermMemory.clear();
      expect(harness.longTermMemory.list().length).toBe(0);

      const imported = harness.longTermMemory.importBackup(restoredSnap);
      expect(imported.imported).toBe(2);
      expect(imported.errors).toEqual([]);

      const hits = harness.longTermMemory.retrieve("TypeScript", {
        minScore: 0.05,
      });
      expect(hits.some((h) => h.record.content.includes("TypeScript"))).toBe(
        true,
      );
      const sensitive = harness.longTermMemory
        .list()
        .find((m) => m.content.includes("sensitive backup"));
      expect(sensitive?.encrypted).toBe(true);
    } finally {
      harness.cleanup();
    }
  });
});

describe("Phase 3 integration — short-term window", () => {
  it("keeps STM conversation turns while LTM stores facts", () => {
    const harness = createMemoryHarness({
      shortTerm: { maxEntries: 10, ttlMs: 0 },
    });
    try {
      harness.shortTerm.append("sess-p3", {
        role: "user",
        text: "hello",
        at: "2026-07-18T12:00:00.000Z",
      });
      harness.shortTerm.append("sess-p3", {
        role: "assistant",
        text: "hi there",
        at: "2026-07-18T12:00:01.000Z",
      });
      expect(harness.shortTerm.getTurns("sess-p3")).toHaveLength(2);

      harness.longTermMemory.store({
        type: "semantic",
        content: "User name is Alex",
        importance: 0.9,
      });
      expect(harness.longTermMemory.list().length).toBe(1);
      expect(harness.shortTerm.getTurns("sess-p3")[0]?.text).toBe("hello");
    } finally {
      harness.cleanup();
    }
  });
});

describe("Phase 3 integration — critical path stability", () => {
  it("runs store → context → knowledge → profile → consolidate → backup", () => {
    const harness = createMemoryHarness({
      retrieval: { minScore: 0.05 },
      knowledgeRetrieval: { minScore: 0.05 },
    });
    try {
      harness.longTermMemory.store({
        type: "semantic",
        content: "User prefers dark mode interfaces",
        importance: 0.9,
        confidence: 0.9,
      });
      harness.profile.set("preferred_editor", "Cursor", {
        source: "explicit",
        confidence: 1,
      });

      const memReq = normalizeRequest({
        source: "cli",
        rawInput: "switch to dark mode please",
        sessionId: "p3-critical",
      });
      const memCtx = loadContext(memReq, detectIntent(memReq), {
        manager: harness.contextManager,
      });
      expect(memCtx.memories.some((m) => m.content.includes("dark mode"))).toBe(
        true,
      );
      expect(memCtx.preferences.preferredEditor).toBe("Cursor");

      const kg = harness.knowledgeGraph.extractAndStore(
        "working on project Atlas with TypeScript",
      );
      expect(kg.stored.length).toBeGreaterThanOrEqual(1);

      const learn = harness.profile.learnFromText(
        "I prefer Cursor and be concise please",
        { autoApply: true, minConfidence: 0.55 },
      );
      expect(learn.stored.length).toBeGreaterThanOrEqual(1);

      harness.longTermMemory.store({
        type: "semantic",
        content: "Prefers TypeScript strictly",
        importance: 0.85,
      });
      harness.longTermMemory.store({
        type: "semantic",
        content: "Prefers TypeScript strictly",
        importance: 0.8,
      });
      const consolidation = harness.longTermMemory.consolidate({
        type: "semantic",
      });
      expect(consolidation.merged + consolidation.conflicts).toBeGreaterThan(0);

      const snap = harness.longTermMemory.exportBackup();
      expect(validateSnapshot(snap).ok).toBe(true);
      expect(snap.count).toBeGreaterThanOrEqual(1);
      expect(harness.longTermMemory.getStats().store.total).toBe(snap.count);
    } finally {
      harness.cleanup();
    }
  });
});
