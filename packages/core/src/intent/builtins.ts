import type { IntentDefinition, IntentMatchResult } from "./types.js";

function capture(
  confidence: number,
  parameters: IntentMatchResult["parameters"],
  goal?: string,
): IntentMatchResult {
  return { confidence, parameters, goal };
}

const helpIntent: IntentDefinition = {
  name: "help",
  category: "system",
  goal: "Show available commands and intents",
  capabilities: [],
  complexity: "low",
  priority: 100,
  match(normalizedText) {
    if (
      !normalizedText ||
      normalizedText === "help" ||
      normalizedText === "?" ||
      normalizedText === "--help"
    ) {
      return capture(1, {});
    }
    return null;
  },
};

const statusIntent: IntentDefinition = {
  name: "system.status",
  category: "system",
  goal: "Report Atlas runtime status",
  capabilities: ["system.info"],
  complexity: "low",
  priority: 90,
  match(normalizedText) {
    if (
      normalizedText === "status" ||
      normalizedText === "ping" ||
      normalizedText === "health" ||
      normalizedText.startsWith("status ")
    ) {
      return capture(0.95, {});
    }
    return null;
  },
};

const echoIntent: IntentDefinition = {
  name: "echo",
  category: "system",
  goal: "Echo text through the pipeline",
  capabilities: [],
  complexity: "low",
  priority: 80,
  match(normalizedText, originalText) {
    if (normalizedText === "echo" || normalizedText.startsWith("echo ")) {
      const text = originalText.replace(/^echo\s*/i, "").trim();
      return capture(0.9, { text: text || "(empty)" });
    }
    return null;
  },
};

function looksLikeFileQuery(target: string): boolean {
  return /\b(files?|documents?|folders?|directories)\b/i.test(target);
}

/**
 * File Search — e.g. "Find my project files", "Search documents".
 * Also catches "open my project files" so it is not mistaken for app launch.
 */
const fileSearchIntent: IntentDefinition = {
  name: "file.search",
  category: "file_search",
  goal: "Search for files or documents",
  capabilities: ["filesystem.read"],
  complexity: "medium",
  priority: 75,
  match(_normalizedText, originalText) {
    const findMatch = /^(?:find|search|locate)\s+(?:my\s+)?(.+)$/i.exec(
      originalText,
    );
    if (findMatch?.[1]) {
      const keyword = findMatch[1].trim();
      return capture(
        0.9,
        { keyword, query: keyword },
        `Search files: ${keyword}`,
      );
    }

    const openFilesMatch = /^(?:open)\s+(?:my\s+)?(.+)$/i.exec(originalText);
    if (openFilesMatch?.[1] && looksLikeFileQuery(openFilesMatch[1])) {
      const keyword = openFilesMatch[1].trim();
      return capture(
        0.85,
        { keyword, query: keyword },
        `Search files: ${keyword}`,
      );
    }

    return null;
  },
};

/**
 * Application Control — e.g. "Open VS Code", "Launch Terminal".
 */
const applicationOpenIntent: IntentDefinition = {
  name: "application.open",
  category: "application_control",
  goal: "Open or launch an application",
  capabilities: ["application.control"],
  complexity: "medium",
  priority: 70,
  match(_normalizedText, originalText) {
    const match = /^(?:open|launch|start|run)\s+(.+)$/i.exec(originalText);
    if (!match?.[1]) {
      return null;
    }
    const application = match[1].trim();
    if (looksLikeFileQuery(application)) {
      return null;
    }
    return capture(0.92, { application }, `Open application: ${application}`);
  },
};

/**
 * Code Analysis — e.g. "Explain this code", "Analyze this file".
 */
const codeAnalyzeIntent: IntentDefinition = {
  name: "code.analyze",
  category: "code_analysis",
  goal: "Analyze or explain code",
  capabilities: ["filesystem.read"],
  complexity: "high",
  priority: 65,
  match(_normalizedText, originalText) {
    const match =
      /^(?:explain|analyze|analyse|review|summarize|summarise)\s+(?:this\s+)?(.+)$/i.exec(
        originalText,
      );
    if (!match?.[1]) {
      return null;
    }
    const target = match[1].trim();
    return capture(
      0.88,
      { target, focus: "explain" },
      `Analyze code: ${target}`,
    );
  },
};

/**
 * Multi-step workflow — e.g. "Prepare my development environment."
 */
const environmentSetupIntent: IntentDefinition = {
  name: "environment.setup",
  category: "workflow",
  goal: "Prepare development environment",
  capabilities: ["application.control", "filesystem.read", "terminal.execute"],
  complexity: "high",
  priority: 88,
  match(_normalizedText, originalText) {
    const match =
      /^(?:prepare|setup|set\s*up)\s+(?:my\s+)?(?:development|dev)\s+environment\.?$/i.exec(
        originalText.trim(),
      );
    if (!match) {
      return null;
    }
    return capture(
      0.93,
      { workflow: "dev-environment" },
      "Prepare development environment",
    );
  },
};

/**
 * Tool discovery — e.g. "tools", "list tools".
 */
const toolsListIntent: IntentDefinition = {
  name: "tools.list",
  category: "system",
  goal: "List registered tools",
  capabilities: [],
  complexity: "low",
  priority: 85,
  match(normalizedText) {
    if (
      normalizedText === "tools" ||
      normalizedText === "list tools" ||
      normalizedText === "show tools" ||
      normalizedText === "available tools"
    ) {
      return capture(0.95, {});
    }
    return null;
  },
};

/** Built-in MVP intent catalog — extend via `IntentRegistry.register`. */
export const BUILTIN_INTENT_DEFINITIONS: readonly IntentDefinition[] = [
  helpIntent,
  statusIntent,
  echoIntent,
  toolsListIntent,
  environmentSetupIntent,
  fileSearchIntent,
  applicationOpenIntent,
  codeAnalyzeIntent,
];
