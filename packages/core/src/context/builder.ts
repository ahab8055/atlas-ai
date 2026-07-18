/**
 * Context Builder — ranked, deduped, budgeted ContextPackage (ADR-0053/0054).
 */
import {
  compressConversation,
  isNearDuplicate,
  type CompressConversationOptions,
} from "./compress.js";
import type {
  ContextPackage,
  ContextSection,
  ContextSectionKind,
  ConversationTurn,
  LoadedContext,
  UserPreferences,
} from "./types.js";

export interface ContextBuilderOptions {
  maxChars?: number;
  maxMemorySnippets?: number;
  maxKnowledgeSnippets?: number;
  maxConversationTurns?: number;
  /** Heuristic conversation compression (ADR-0054). */
  compression?: CompressConversationOptions & {
    nearDuplicateThreshold?: number;
  };
}

export const DEFAULT_CONTEXT_BUILDER_OPTIONS = {
  maxChars: 4000,
  maxMemorySnippets: 5,
  maxKnowledgeSnippets: 5,
  maxConversationTurns: 6,
} as const satisfies Required<Omit<ContextBuilderOptions, "compression">>;

const PREFERENCE_KEYS = [
  "preferredEditor",
  "preferredLanguage",
  "codingStyle",
  "codingLanguage",
  "communicationStyle",
  "responseLength",
  "aiVerbosity",
  "productivityHabits",
] as const;

/** Lower priority number = packed first. */
const SECTION_PRIORITY: Record<ContextSectionKind, number> = {
  request: 1,
  active_tasks: 2,
  project: 3,
  preferences: 4,
  conversation_summary: 5,
  memories: 6,
  knowledge: 7,
  conversation: 8,
  system: 9,
};

/**
 * Build an AI-ready ContextPackage from LoadedContext.
 */
export function buildContextPackage(
  context: LoadedContext,
  options: ContextBuilderOptions = {},
): ContextPackage {
  const maxChars = Math.max(
    256,
    options.maxChars ?? DEFAULT_CONTEXT_BUILDER_OPTIONS.maxChars,
  );
  const maxMemory =
    options.maxMemorySnippets ??
    DEFAULT_CONTEXT_BUILDER_OPTIONS.maxMemorySnippets;
  const maxKnowledge =
    options.maxKnowledgeSnippets ??
    DEFAULT_CONTEXT_BUILDER_OPTIONS.maxKnowledgeSnippets;
  const maxTurns =
    options.maxConversationTurns ??
    DEFAULT_CONTEXT_BUILDER_OPTIONS.maxConversationTurns;
  const nearDupThreshold = options.compression?.nearDuplicateThreshold ?? 0.85;

  const seenExact = new Set<string>();
  const seenLines: string[] = [];
  const draftSections: ContextSection[] = [];

  const requestText = latestUserText(context);
  if (requestText) {
    pushSection(draftSections, seenExact, seenLines, nearDupThreshold, {
      kind: "request",
      lines: [`Current request: ${requestText}`],
    });
  }

  const taskLines = (context.activeTasks ?? [])
    .filter((t) => t.status === "pending" || t.status === "in_progress")
    .map((t) => `${t.status}: ${t.description.trim()}`)
    .filter(Boolean);
  if (taskLines.length > 0) {
    pushSection(draftSections, seenExact, seenLines, nearDupThreshold, {
      kind: "active_tasks",
      lines: taskLines,
    });
  }

  const projectLines = formatProjectLines(context);
  if (projectLines.length > 0) {
    pushSection(draftSections, seenExact, seenLines, nearDupThreshold, {
      kind: "project",
      lines: projectLines,
    });
  }

  const prefLines = formatPreferenceLines(context.preferences);
  if (prefLines.length > 0) {
    pushSection(draftSections, seenExact, seenLines, nearDupThreshold, {
      kind: "preferences",
      lines: prefLines,
    });
  }

  const allTurns = context.conversation?.turns ?? [];
  const compressed = compressConversation(allTurns, {
    enabled: options.compression?.enabled !== false,
    keepRecentTurns:
      options.compression?.keepRecentTurns ?? Math.min(4, maxTurns),
    maxSummaryLines: options.compression?.maxSummaryLines ?? 8,
    maxConversationChars: Math.floor(maxChars * 0.35),
  });

  if (compressed.summaryLines.length > 0) {
    pushSection(draftSections, seenExact, seenLines, nearDupThreshold, {
      kind: "conversation_summary",
      lines: compressed.summaryLines,
    });
  }

  const memoryLines = [...(context.memories ?? [])]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, maxMemory)
    .map((m) => m.content.trim())
    .filter(Boolean);
  if (memoryLines.length > 0) {
    pushSection(draftSections, seenExact, seenLines, nearDupThreshold, {
      kind: "memories",
      lines: memoryLines,
    });
  }

  const knowledgeLines = [...(context.knowledge ?? [])]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, maxKnowledge)
    .map((k) => (k.content || k.label).trim())
    .filter(Boolean);
  if (knowledgeLines.length > 0) {
    pushSection(draftSections, seenExact, seenLines, nearDupThreshold, {
      kind: "knowledge",
      lines: knowledgeLines,
    });
  }

  const conversationSource: ConversationTurn[] = compressed.stats.compressed
    ? compressed.recentTurns
    : allTurns;
  const conversationLines = formatConversationLines(
    conversationSource,
    requestText,
    maxTurns,
  );
  if (conversationLines.length > 0) {
    pushSection(draftSections, seenExact, seenLines, nearDupThreshold, {
      kind: "conversation",
      lines: conversationLines,
    });
  }

  const systemLine = formatSystemLine(context);
  if (systemLine) {
    pushSection(draftSections, seenExact, seenLines, nearDupThreshold, {
      kind: "system",
      lines: [systemLine],
    });
  }

  draftSections.sort((a, b) => a.priority - b.priority);

  const packed: ContextSection[] = [];
  let usedChars = 0;
  let truncated = false;

  for (const section of draftSections) {
    const header = sectionHeader(section.kind);
    const body = section.lines.map((l) => `- ${l}`).join("\n");
    const block = `${header}\n${body}`;
    const cost = block.length + (packed.length > 0 ? 2 : 0);
    if (usedChars + cost > maxChars) {
      truncated = true;
      const remaining = maxChars - usedChars - header.length - 2;
      if (remaining > 40) {
        const clipped = clipLines(section.lines, remaining);
        if (clipped.length > 0) {
          const partial: ContextSection = {
            ...section,
            lines: clipped,
            estimatedChars: clipped.join("\n").length,
          };
          packed.push(partial);
          usedChars = maxChars;
        }
      }
      break;
    }
    packed.push(section);
    usedChars += cost;
  }

  const text = packed
    .map(
      (s) =>
        `${sectionHeader(s.kind)}\n${s.lines.map((l) => `- ${l}`).join("\n")}`,
    )
    .join("\n\n");

  return {
    assembledAt: new Date().toISOString(),
    sections: packed,
    text,
    planNotes: buildPlanNotes(packed),
    responseNotes: buildResponseNotes(packed),
    stats: {
      sectionCount: packed.length,
      usedChars: text.length,
      maxChars,
      truncated,
    },
  };
}

/**
 * Attach a fresh ContextPackage onto LoadedContext (mutates and returns).
 * When compression produces summary facts, refresh conversationSummary.
 */
export function attachContextPackage(
  context: LoadedContext,
  options?: ContextBuilderOptions,
): LoadedContext {
  const pkg = buildContextPackage(context, options);
  context.contextPackage = pkg;
  const summarySection = pkg.sections.find(
    (s) => s.kind === "conversation_summary",
  );
  if (summarySection && summarySection.lines.length > 0) {
    context.conversationSummary = summarySection.lines.join("; ");
  }
  return context;
}

function pushSection(
  sections: ContextSection[],
  seenExact: Set<string>,
  seenLines: string[],
  nearDupThreshold: number,
  input: { kind: ContextSectionKind; lines: string[] },
): void {
  const lines: string[] = [];
  for (const raw of input.lines) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    const key = normalizeDedup(line);
    if (seenExact.has(key)) {
      continue;
    }
    if (
      seenLines.some((prev) => isNearDuplicate(prev, line, nearDupThreshold))
    ) {
      continue;
    }
    seenExact.add(key);
    seenLines.push(line);
    lines.push(line);
  }
  if (lines.length === 0) {
    return;
  }
  sections.push({
    kind: input.kind,
    priority: SECTION_PRIORITY[input.kind],
    lines,
    estimatedChars: lines.join("\n").length,
  });
}

function normalizeDedup(line: string): string {
  return line.trim().toLowerCase().replace(/\s+/g, " ");
}

function latestUserText(context: LoadedContext): string | undefined {
  const turns = context.conversation?.turns ?? [];
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn?.role === "user" && turn.text.trim()) {
      return turn.text.trim();
    }
  }
  const summary = context.conversationSummary?.trim();
  return summary || undefined;
}

function formatProjectLines(context: LoadedContext): string[] {
  const project = context.project;
  if (!project?.name?.trim() && !project?.path?.trim()) {
    return [];
  }
  const name = project.name?.trim() || "project";
  const path = project.path?.trim();
  const lines = [path ? `${name} (${path})` : name];
  if (project.repoUrl?.trim()) {
    lines.push(`repo: ${project.repoUrl.trim()}`);
  }
  if (project.defaultBranch?.trim()) {
    lines.push(`branch: ${project.defaultBranch.trim()}`);
  }
  return lines;
}

function formatPreferenceLines(prefs: UserPreferences | undefined): string[] {
  if (!prefs) {
    return [];
  }
  const lines: string[] = [];
  for (const key of PREFERENCE_KEYS) {
    const value = prefs[key];
    if (typeof value === "string" && value.trim()) {
      lines.push(`${key}=${value.trim()}`);
    }
  }
  return lines;
}

function formatConversationLines(
  turns: readonly ConversationTurn[],
  requestText: string | undefined,
  maxTurns: number,
): string[] {
  if (turns.length === 0) {
    return [];
  }
  const requestNorm = requestText ? normalizeDedup(requestText) : "";
  const lines: string[] = [];
  const slice = turns.slice(-Math.max(1, maxTurns));
  for (const turn of slice) {
    const text = turn.text.trim();
    if (!text) {
      continue;
    }
    if (turn.role === "user" && normalizeDedup(text) === requestNorm) {
      continue;
    }
    lines.push(`${turn.role}: ${text}`);
  }
  return lines;
}

function formatSystemLine(context: LoadedContext): string | undefined {
  const s = context.systemState;
  if (!s) {
    return undefined;
  }
  return `system: ${s.platform}/${s.arch} node=${s.nodeVersion} source=${s.source}`;
}

function sectionHeader(kind: ContextSectionKind): string {
  switch (kind) {
    case "request":
      return "Current request";
    case "active_tasks":
      return "Active tasks";
    case "project":
      return "Active project";
    case "preferences":
      return "User preferences";
    case "conversation_summary":
      return "Conversation summary";
    case "memories":
      return "Recalled memories";
    case "knowledge":
      return "Related knowledge";
    case "conversation":
      return "Conversation";
    case "system":
      return "System state";
    default:
      return kind;
  }
}

function buildPlanNotes(sections: ContextSection[]): string[] {
  const notes: string[] = [];
  for (const section of sections) {
    if (section.kind === "request" || section.kind === "system") {
      continue;
    }
    if (section.kind === "conversation_summary") {
      notes.push(`Conversation summary: ${section.lines.join("; ")}`);
      continue;
    }
    if (section.kind === "memories") {
      notes.push(`Recalled memories: ${section.lines.join("; ")}`);
      continue;
    }
    if (section.kind === "knowledge") {
      notes.push(`Related knowledge: ${section.lines.join("; ")}`);
      continue;
    }
    if (section.kind === "preferences") {
      notes.push(`User preferences: ${section.lines.slice(0, 4).join("; ")}`);
      continue;
    }
    if (section.kind === "project") {
      notes.push(`Active project: ${section.lines[0]}`);
      continue;
    }
    if (section.kind === "active_tasks") {
      notes.push(`Active tasks: ${section.lines.join("; ")}`);
      continue;
    }
    if (section.kind === "conversation") {
      notes.push(`Conversation: ${section.lines.slice(-2).join("; ")}`);
    }
  }
  return notes;
}

function buildResponseNotes(sections: ContextSection[]): string[] {
  const notes: string[] = [];
  for (const section of sections) {
    if (section.kind === "request") {
      continue;
    }
    const header = sectionHeader(section.kind);
    const body = section.lines.map((l) => `- ${l}`).join("\n");
    notes.push(`${header}:\n${body}`);
  }
  return notes;
}

function clipLines(lines: string[], remainingChars: number): string[] {
  const out: string[] = [];
  let used = 0;
  for (const line of lines) {
    const cost = line.length + 3;
    if (used + cost > remainingChars) {
      break;
    }
    out.push(line);
    used += cost;
  }
  return out;
}
