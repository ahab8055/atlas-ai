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
  return finalizePlan({
    goal: built.goal,
    intentName: intent.name,
    steps: built.steps,
    requiresApproval: built.requiresApproval,
  });
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
