/**
 * Model Router — select the best registered model per task (Architecture/25).
 */
import { detectHardware } from "../hardware-detection/detect.js";
import {
  recommendModelsForProfile,
  type RecommendableModel,
} from "../hardware-detection/recommend.js";
import type { ModelSizeClass } from "../hardware-detection/resource-profiles.js";
import { checkModelCompatibility } from "../model-compatibility/checker.js";
import type { RegisteredModel } from "../model-registry/types.js";
import { analyzeTask } from "./analyze.js";
import type { RouteModelInput, RoutingDecision, RoutingMode } from "./types.js";

export interface ModelRouterOptions {
  modelsDir?: string;
  fallbackModelId?: string;
  skipGpuProbe?: boolean;
}

function desiredSizeClass(
  complexity: RoutingDecision["task"]["complexity"],
  taskType: RoutingDecision["task"]["taskType"],
): ModelSizeClass {
  if (complexity === "complex" || taskType === "reasoning") {
    return "large";
  }
  if (complexity === "simple" && taskType === "conversation") {
    return "small";
  }
  if (taskType === "coding") {
    return complexity === "simple" ? "medium" : "large";
  }
  return complexity === "simple" ? "small" : "medium";
}

function capabilityHints(
  taskType: RoutingDecision["task"]["taskType"],
): string[] {
  switch (taskType) {
    case "coding":
      return ["coding", "chat"];
    case "reasoning":
      return ["reasoning", "chat", "local"];
    case "conversation":
      return ["chat", "local"];
    default:
      return ["chat", "local"];
  }
}

function findModel(
  models: RegisteredModel[],
  modelId: string,
): RegisteredModel | undefined {
  const exact = models.find((m) => m.id === modelId);
  if (exact) {
    return exact;
  }
  const base = modelId.includes("/")
    ? modelId.slice(modelId.lastIndexOf("/") + 1)
    : modelId;
  return models.find(
    (m) =>
      m.id === base ||
      m.id.endsWith(`/${base}`) ||
      m.id.replace(/\.gguf$/i, "") === base,
  );
}

function scoreForTask(
  model: RecommendableModel,
  hints: string[],
  sizeClass: ModelSizeClass,
): { boost: number; reasons: string[] } {
  const reasons: string[] = [];
  let boost = 0;
  const caps = model.capabilities ?? [];
  for (const hint of hints) {
    if (caps.includes(hint)) {
      boost += 15;
      reasons.push(`capability:${hint}`);
    }
  }
  if (model.id.startsWith("coding/") && hints.includes("coding")) {
    boost += 10;
    reasons.push("slot:coding");
  }
  if (model.id.startsWith("general/") && sizeClass === "small") {
    boost += 5;
    reasons.push("slot:general");
  }
  return { boost, reasons };
}

/**
 * Select a model for a task. Manual `preferredModelId` bypasses auto routing.
 */
export function routeModel(input: RouteModelInput): RoutingDecision {
  const mode: RoutingMode =
    input.mode ?? (input.preferredModelId ? "manual" : "auto");
  const hardware =
    input.hardware ??
    detectHardware({ skipGpuProbe: input.skipGpuProbe ?? false });
  const task = analyzeTask({
    prompt: input.prompt,
    messages: input.messages,
  });
  const preferredSizeClass = desiredSizeClass(task.complexity, task.taskType);
  const hints = capabilityHints(task.taskType);
  const reasons: string[] = [
    `task: ${task.summary}`,
    `target size class: ${preferredSizeClass}`,
    `hardware profile: ${hardware.profileId}`,
  ];

  if (mode === "manual" && input.preferredModelId) {
    const model = findModel(input.models, input.preferredModelId);
    const compat = model
      ? checkModelCompatibility({
          modelId: model.id,
          requirements: model.requirements,
          sizeBytes: model.sizeBytes,
          hardware,
          mode: "runtime",
        })
      : undefined;
    return {
      mode: "manual",
      modelId: input.preferredModelId,
      model,
      task,
      preferredSizeClass,
      hardwareProfileId: hardware.profileId,
      reasons: [
        ...reasons,
        `manual selection: ${input.preferredModelId}`,
        ...(compat && !compat.compatible ? [`warning: ${compat.summary}`] : []),
      ],
      alternatives: input.models
        .map((m) => m.id)
        .filter((id) => id !== model?.id),
      routed: Boolean(model),
      hardware,
    };
  }

  const available = input.models.filter(
    (m) => m.status === "available" || m.status === "loaded",
  );

  const primaryCapability = hints[0];
  const capabilityMatched = available.filter((m) =>
    (m.capabilities ?? []).includes(primaryCapability),
  );
  const candidates =
    capabilityMatched.length > 0 ? capabilityMatched : available;
  if (capabilityMatched.length > 0) {
    reasons.push(`filtered to models with ${primaryCapability} capability`);
  }

  if (candidates.length === 0) {
    const fallback = input.fallbackModelId;
    return {
      mode: "auto",
      modelId: fallback,
      task,
      preferredSizeClass,
      hardwareProfileId: hardware.profileId,
      reasons: [...reasons, "no registered models — using fallback"],
      alternatives: [],
      routed: Boolean(fallback),
      hardware,
    };
  }

  const ranked = recommendModelsForProfile(candidates, {
    hardware,
    limit: 10,
    preferredSizeClass,
  });

  const boosted = ranked
    .map((entry) => {
      const extra = scoreForTask(entry.model, hints, preferredSizeClass);
      return {
        ...entry,
        score: entry.score + extra.boost,
        reasons: [...entry.reasons, ...extra.reasons],
      };
    })
    .sort((a, b) => b.score - a.score);

  const top = boosted[0];
  if (!top) {
    const fallback = input.fallbackModelId;
    return {
      mode: "auto",
      modelId: fallback,
      task,
      preferredSizeClass,
      hardwareProfileId: hardware.profileId,
      reasons: [...reasons, "no compatible model — using fallback"],
      alternatives: [],
      routed: Boolean(fallback),
      hardware,
    };
  }

  const selected = top.model as RegisteredModel;
  reasons.push(
    `selected ${selected.id} (score=${top.score})`,
    ...top.reasons.slice(0, 4),
  );

  return {
    mode: "auto",
    modelId: selected.id,
    model: selected,
    task,
    preferredSizeClass,
    hardwareProfileId: hardware.profileId,
    reasons,
    alternatives: boosted.slice(1, 4).map((r) => r.model.id),
    routed: true,
    hardware,
  };
}

export function formatRoutingDecision(decision: RoutingDecision): string {
  const lines = [
    `Routing: ${decision.routed ? "OK" : "FAILED"} (${decision.mode})`,
    `Task: ${decision.task.summary}`,
    `Complexity: ${decision.task.complexity} | Type: ${decision.task.taskType}`,
    `Hardware profile: ${decision.hardwareProfileId}`,
    `Preferred size: ${decision.preferredSizeClass}`,
    ...(decision.modelId ? [`Selected model: ${decision.modelId}`] : []),
    "Reasons:",
    ...decision.reasons.map((r) => `  - ${r}`),
  ];
  if (decision.alternatives.length > 0) {
    lines.push(`Alternatives: ${decision.alternatives.join(", ")}`);
  }
  return lines.join("\n");
}

export class ModelRouter {
  constructor(private readonly options: ModelRouterOptions = {}) {}

  select(
    input: Omit<RouteModelInput, "fallbackModelId" | "skipGpuProbe">,
  ): RoutingDecision {
    return routeModel({
      ...input,
      fallbackModelId: this.options.fallbackModelId,
      skipGpuProbe: this.options.skipGpuProbe,
      hardware: input.hardware,
    });
  }
}

export function createModelRouter(
  options: ModelRouterOptions = {},
): ModelRouter {
  return new ModelRouter(options);
}
