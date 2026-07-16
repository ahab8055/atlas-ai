/**
 * Heuristic task classification + complexity analysis (MVP router).
 */
import type { ComplexityLevel, TaskAnalysis, TaskType } from "./types.js";

const CODING_PATTERNS =
  /\b(code|coding|implement|refactor|debug|function|class|typescript|python|rust|api|sql|regex|compile|lint|unit test|pull request|pr\b|git)\b/i;

const REASONING_PATTERNS =
  /\b(architect|architecture|design|trade-?off|distributed|scal(e|ing)|reason|analyze|analyse|compare|evaluate|strategy|system design|proof|theorem|optimize|performance review)\b/i;

const SIMPLE_PATTERNS =
  /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|help)\b/i;

function extractText(input: {
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
}): string {
  if (input.prompt?.trim()) {
    return input.prompt.trim();
  }
  if (input.messages && input.messages.length > 0) {
    const lastUser = [...input.messages]
      .reverse()
      .find((m) => m.role === "user");
    return (
      lastUser?.content?.trim() ??
      input.messages.map((m) => m.content).join("\n")
    );
  }
  return "";
}

function classifyTaskType(text: string): { type: TaskType; signals: string[] } {
  const signals: string[] = [];
  if (CODING_PATTERNS.test(text)) {
    signals.push("coding keywords");
    return { type: "coding", signals };
  }
  if (REASONING_PATTERNS.test(text)) {
    signals.push("reasoning / architecture keywords");
    return { type: "reasoning", signals };
  }
  if (text.length < 120 && SIMPLE_PATTERNS.test(text)) {
    signals.push("short conversational opener");
    return { type: "conversation", signals };
  }
  if (text.length < 200 && !text.includes("```")) {
    signals.push("short general prompt");
    return { type: "conversation", signals };
  }
  return { type: "general", signals: ["default general task"] };
}

function classifyComplexity(
  text: string,
  taskType: TaskType,
): { level: ComplexityLevel; signals: string[] } {
  const signals: string[] = [];
  const words = text.split(/\s+/).filter(Boolean).length;
  const hasCodeFence = text.includes("```");
  const longPrompt = words > 120 || text.length > 800;

  if (
    taskType === "reasoning" ||
    (taskType === "coding" && (hasCodeFence || words > 60))
  ) {
    signals.push("deep task — reasoning or substantial code");
    return { level: "complex", signals };
  }
  if (taskType === "coding" || longPrompt || words > 40) {
    signals.push("moderate length or coding scope");
    return { level: "moderate", signals };
  }
  if (words < 25 && !hasCodeFence) {
    signals.push("short prompt");
    return { level: "simple", signals };
  }
  return { level: "moderate", signals: ["default moderate"] };
}

/**
 * Analyze prompt/messages for task type and complexity.
 */
export function analyzeTask(input: {
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
}): TaskAnalysis {
  const text = extractText(input);
  const { type, signals: typeSignals } = classifyTaskType(text);
  const { level, signals: complexitySignals } = classifyComplexity(text, type);
  const signals = [...typeSignals, ...complexitySignals];

  const confidence =
    type === "reasoning" || type === "coding"
      ? 0.85
      : level === "simple"
        ? 0.75
        : 0.65;

  return {
    taskType: type,
    complexity: level,
    confidence,
    summary: `${level} ${type} task (${wordsSummary(text)})`,
    signals,
  };
}

function wordsSummary(text: string): string {
  const n = text.split(/\s+/).filter(Boolean).length;
  return `${n} words`;
}
