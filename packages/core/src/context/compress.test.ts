import { describe, expect, it } from "vitest";

import { compressConversation, isNearDuplicate } from "./compress.js";
import type { ConversationTurn } from "./types.js";

function turn(
  role: ConversationTurn["role"],
  text: string,
  i: number,
): ConversationTurn {
  return {
    role,
    text,
    at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
  };
}

describe("compressConversation", () => {
  it("does not compress short histories", () => {
    const turns = [
      turn("user", "hello", 0),
      turn("assistant", "hi", 1),
      turn("user", "status", 2),
    ];
    const result = compressConversation(turns, { keepRecentTurns: 4 });
    expect(result.stats.compressed).toBe(false);
    expect(result.summaryLines).toHaveLength(0);
    expect(result.recentTurns).toHaveLength(3);
  });

  it("extracts preference facts from older turns and keeps recent raw", () => {
    const turns = [
      turn("user", "I prefer Cursor for editing", 0),
      turn("assistant", "Noted", 1),
      turn("user", "We decided to use TypeScript", 2),
      turn("assistant", "OK", 3),
      turn("user", "open the file", 4),
      turn("assistant", "Opening", 5),
      turn("user", "status now", 6),
    ];
    const result = compressConversation(turns, {
      keepRecentTurns: 2,
      maxSummaryLines: 8,
    });
    expect(result.stats.compressed).toBe(true);
    expect(result.recentTurns).toHaveLength(2);
    expect(result.recentTurns[1]?.text).toBe("status now");
    expect(result.summaryLines.some((l) => /prefer|Cursor/i.test(l))).toBe(
      true,
    );
    expect(result.summaryLines.some((l) => /decid|TypeScript/i.test(l))).toBe(
      true,
    );
    expect(
      result.recentTurns.some((t) => t.text.includes("I prefer Cursor")),
    ).toBe(false);
  });

  it("respects maxSummaryLines", () => {
    const turns = Array.from({ length: 20 }, (_, i) =>
      turn(
        i % 2 === 0 ? "user" : "assistant",
        i % 2 === 0 ? `I prefer tool-${i} and always use it` : `ack ${i}`,
        i,
      ),
    );
    const result = compressConversation(turns, {
      keepRecentTurns: 2,
      maxSummaryLines: 3,
    });
    expect(result.summaryLines.length).toBeLessThanOrEqual(3);
  });
});

describe("isNearDuplicate", () => {
  it("detects exact and high-overlap duplicates", () => {
    expect(isNearDuplicate("User prefers Cursor", "user prefers cursor")).toBe(
      true,
    );
    expect(
      isNearDuplicate(
        "User prefers dark mode interfaces",
        "User prefers dark mode",
      ),
    ).toBe(true);
    expect(isNearDuplicate("alpha beta", "completely different topic")).toBe(
      false,
    );
  });
});
