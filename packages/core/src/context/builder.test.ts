import { describe, expect, it } from "vitest";

import { buildContextPackage } from "./builder.js";
import type { LoadedContext } from "./types.js";

function baseContext(overrides: Partial<LoadedContext> = {}): LoadedContext {
  const assembledAt = new Date().toISOString();
  return {
    assembledAt,
    sources: ["conversation", "system"],
    conversation: {
      sessionId: "s1",
      turns: [
        {
          role: "user",
          text: "Open the editor",
          at: assembledAt,
        },
      ],
      summary: "user: Open the editor",
    },
    preferences: {},
    activeTasks: [],
    systemState: {
      runtime: "node",
      source: "cli",
      platform: "darwin",
      arch: "arm64",
      nodeVersion: "v22.0.0",
      collectedAt: assembledAt,
    },
    memories: [],
    knowledge: [],
    conversationSummary: "user: Open the editor",
    ...overrides,
  };
}

describe("buildContextPackage", () => {
  it("packs sections in priority order", () => {
    const pkg = buildContextPackage(
      baseContext({
        project: { name: "Atlas", path: "/tmp/atlas" },
        preferences: { preferredEditor: "Cursor" },
        memories: [
          {
            id: "m1",
            content: "User prefers dark mode",
            kind: "semantic",
            score: 0.9,
          },
        ],
        knowledge: [
          {
            id: "k1",
            label: "TypeScript",
            content: "technology: TypeScript",
            score: 0.8,
          },
        ],
      }),
    );

    const kinds = pkg.sections.map((s) => s.kind);
    expect(kinds.indexOf("request")).toBeLessThan(kinds.indexOf("project"));
    expect(kinds.indexOf("project")).toBeLessThan(kinds.indexOf("preferences"));
    expect(kinds.indexOf("preferences")).toBeLessThan(
      kinds.indexOf("memories"),
    );
    expect(kinds.indexOf("memories")).toBeLessThan(kinds.indexOf("knowledge"));
    expect(kinds.indexOf("knowledge")).toBeLessThan(kinds.indexOf("system"));
    expect(pkg.planNotes.some((n) => n.includes("Active project"))).toBe(true);
    expect(pkg.planNotes.some((n) => n.includes("Recalled memories"))).toBe(
      true,
    );
  });

  it("compresses long conversation into summary and keeps recent turns", () => {
    const assembledAt = new Date().toISOString();
    const turns = [
      {
        role: "user" as const,
        text: "I prefer Cursor for all editing",
        at: assembledAt,
      },
      { role: "assistant" as const, text: "Noted", at: assembledAt },
      {
        role: "user" as const,
        text: "We decided to use TypeScript strict mode",
        at: assembledAt,
      },
      { role: "assistant" as const, text: "OK", at: assembledAt },
      { role: "user" as const, text: "list files", at: assembledAt },
      { role: "assistant" as const, text: "listing", at: assembledAt },
      { role: "user" as const, text: "status please", at: assembledAt },
    ];
    const pkg = buildContextPackage(
      baseContext({
        conversation: { sessionId: "s1", turns, summary: "…" },
        conversationSummary: "…",
      }),
      {
        compression: { enabled: true, keepRecentTurns: 2, maxSummaryLines: 8 },
      },
    );
    const summary = pkg.sections.find((s) => s.kind === "conversation_summary");
    expect(summary?.lines.length).toBeGreaterThan(0);
    expect(pkg.planNotes.some((n) => n.includes("Conversation summary"))).toBe(
      true,
    );
    const convo = pkg.sections.find((s) => s.kind === "conversation");
    expect(convo?.lines.some((l) => /prefer Cursor/i.test(l)) ?? false).toBe(
      false,
    );
  });

  it("near-dedupes memory against conversation summary", () => {
    const assembledAt = new Date().toISOString();
    const turns = [
      {
        role: "user" as const,
        text: "I prefer Cursor for editing work",
        at: assembledAt,
      },
      { role: "assistant" as const, text: "ok", at: assembledAt },
      { role: "user" as const, text: "hello again", at: assembledAt },
      { role: "assistant" as const, text: "hi", at: assembledAt },
      { role: "user" as const, text: "status", at: assembledAt },
    ];
    const pkg = buildContextPackage(
      baseContext({
        conversation: { sessionId: "s1", turns, summary: "…" },
        memories: [
          {
            id: "m1",
            content: "Preference: I prefer Cursor for editing work",
            kind: "semantic",
            score: 0.9,
          },
        ],
      }),
      { compression: { keepRecentTurns: 2 } },
    );
    const memory = pkg.sections.find((s) => s.kind === "memories");
    expect(memory?.lines ?? []).toHaveLength(0);
  });

  it("dedupes overlapping memory and knowledge lines", () => {
    const shared = "User prefers TypeScript";
    const pkg = buildContextPackage(
      baseContext({
        memories: [{ id: "m1", content: shared, kind: "semantic" }],
        knowledge: [{ id: "k1", label: shared, content: shared, score: 0.5 }],
      }),
    );
    const memory = pkg.sections.find((s) => s.kind === "memories");
    const knowledge = pkg.sections.find((s) => s.kind === "knowledge");
    expect(memory?.lines).toContain(shared);
    expect(knowledge?.lines ?? []).not.toContain(shared);
  });

  it("truncates when over maxChars", () => {
    const pkg = buildContextPackage(
      baseContext({
        memories: Array.from({ length: 20 }, (_, i) => ({
          id: `m${i}`,
          content: `Long memory fact number ${i} `.repeat(20),
          kind: "semantic" as const,
          score: 1 - i * 0.01,
        })),
      }),
      { maxChars: 500 },
    );
    expect(pkg.stats.truncated).toBe(true);
    expect(pkg.stats.usedChars).toBeLessThanOrEqual(500);
  });

  it("returns empty-ish package when only empty sources", () => {
    const pkg = buildContextPackage(
      baseContext({
        conversation: { sessionId: "s1", turns: [], summary: "" },
        conversationSummary: "",
        systemState: {
          runtime: "node",
          source: "cli",
          platform: "darwin",
          arch: "arm64",
          nodeVersion: "v22",
          collectedAt: new Date().toISOString(),
        },
      }),
    );
    expect(pkg.sections.some((s) => s.kind === "system")).toBe(true);
    expect(pkg.planNotes).toEqual([]);
  });
});
