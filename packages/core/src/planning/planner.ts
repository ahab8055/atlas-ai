import { finalizePlan } from "./builders.js";
import { BUILTIN_PLAN_TEMPLATES } from "./templates.js";
import type { ExecutionPlan, PlanInput, PlanTemplate } from "./types.js";
import { draftStep } from "./builders.js";

/**
 * Registry of plan templates keyed by intent name.
 */
export class PlanRegistry {
  private readonly templates = new Map<string, PlanTemplate>();

  constructor(initial: readonly PlanTemplate[] = []) {
    for (const template of initial) {
      this.register(template);
    }
  }

  register(template: PlanTemplate): void {
    this.templates.set(template.intentName, template);
  }

  unregister(intentName: string): boolean {
    return this.templates.delete(intentName);
  }

  get(intentName: string): PlanTemplate | undefined {
    return this.templates.get(intentName);
  }

  list(): PlanTemplate[] {
    return [...this.templates.values()].sort(
      (a, b) =>
        b.priority - a.priority || a.intentName.localeCompare(b.intentName),
    );
  }
}

const defaultRegistry = new PlanRegistry(BUILTIN_PLAN_TEMPLATES);

export function getDefaultPlanRegistry(): PlanRegistry {
  return defaultRegistry;
}

export function registerPlanTemplate(template: PlanTemplate): void {
  defaultRegistry.register(template);
}

export interface CreatePlanOptions {
  registry?: PlanRegistry;
}

/**
 * Build a structured execution plan from intent + context.
 * Plans are ordered and tool-system ready (`tool` / `args` / `capability`).
 */
export function createPlan(
  request: PlanInput["request"],
  intent: PlanInput["intent"],
  context: PlanInput["context"],
  options: CreatePlanOptions = {},
): ExecutionPlan {
  const registry = options.registry ?? defaultRegistry;
  const template =
    registry.get(intent.name) ?? registry.get("unknown") ?? fallbackUnknown;

  const built = template.build({ request, intent, context });
  const notes: string[] = [];
  const recalled = formatRecalledMemories(context);
  if (recalled) {
    notes.push(recalled);
  }
  const knowledge = formatRelatedKnowledge(context);
  if (knowledge) {
    notes.push(knowledge);
  }
  const prefs = formatUserPreferences(context);
  if (prefs) {
    notes.push(prefs);
  }
  const goal =
    notes.length > 0 ? `${built.goal} | ${notes.join(" | ")}` : built.goal;
  return finalizePlan({
    goal,
    intentName: intent.name,
    steps: built.steps,
    requiresApproval: built.requiresApproval,
  });
}

function formatRecalledMemories(
  context: PlanInput["context"],
): string | undefined {
  if (!context.memories || context.memories.length === 0) {
    return undefined;
  }
  const snippets = context.memories
    .slice(0, 3)
    .map((m) => m.content.trim())
    .filter(Boolean);
  if (snippets.length === 0) {
    return undefined;
  }
  return `Recalled memories: ${snippets.join("; ")}`;
}

function formatRelatedKnowledge(
  context: PlanInput["context"],
): string | undefined {
  if (!context.knowledge || context.knowledge.length === 0) {
    return undefined;
  }
  const snippets = context.knowledge
    .slice(0, 3)
    .map((k) => (k.content || k.label).trim())
    .filter(Boolean);
  if (snippets.length === 0) {
    return undefined;
  }
  return `Related knowledge: ${snippets.join("; ")}`;
}

const PREFERENCE_DISPLAY_KEYS = [
  "preferredEditor",
  "preferredLanguage",
  "codingStyle",
  "codingLanguage",
  "communicationStyle",
  "responseLength",
  "aiVerbosity",
  "productivityHabits",
] as const;

function formatUserPreferences(
  context: PlanInput["context"],
): string | undefined {
  const prefs = context.preferences;
  if (!prefs) {
    return undefined;
  }
  const parts: string[] = [];
  for (const key of PREFERENCE_DISPLAY_KEYS) {
    const value = prefs[key];
    if (typeof value === "string" && value.trim()) {
      parts.push(`${key}=${value.trim()}`);
    }
  }
  if (parts.length === 0) {
    return undefined;
  }
  return `User preferences: ${parts.slice(0, 4).join("; ")}`;
}

const fallbackUnknown: PlanTemplate = {
  intentName: "unknown",
  priority: 0,
  build({ request, intent }) {
    return {
      goal: intent.goal || "Handle request",
      requiresApproval: false,
      steps: [
        draftStep("reply", `Handle intent ${intent.name}`, {
          args: { text: request.text, ...intent.parameters },
        }),
      ],
    };
  },
};
