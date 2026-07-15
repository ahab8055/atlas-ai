import { listToolMetadata } from "@atlas-ai/tools";

import type { DetectedIntent } from "../intent/types.js";
import type { NormalizedRequest } from "../types.js";

export function formatParams(intent: DetectedIntent): string {
  const entries = Object.entries(intent.parameters).filter(
    ([, value]) => value !== undefined && value !== "",
  );
  if (entries.length === 0) {
    return "(none)";
  }
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ");
}

export function buildHelpText(): { text: string; spokenText: string } {
  const toolNames = listToolMetadata()
    .map((t) => t.name)
    .sort()
    .join(", ");

  const text = [
    "Atlas AI — available commands & intents:",
    "  help                                  Show this message",
    "  status | ping                         Runtime status",
    "  echo <text>                           Echo text through the pipeline",
    "  tools | list tools                    List registered tools",
    "  Open VS Code                          Application Control (simple plan)",
    "  Find my project files                 File Search (simple plan)",
    "  Explain this code                     Code Analysis (simple plan)",
    "  Prepare my development environment    Multi-step setup plan",
    "  <unrecognized>                        Handled as unknown intent",
    "",
    `Registered tools: ${toolNames || "(none)"}`,
  ].join("\n");

  const spokenText =
    "Atlas can help with status, echo, listing tools, opening VS Code, finding project files, explaining code, and preparing your development environment. Say help anytime for this overview.";

  return { text, spokenText };
}

export function buildToolsListText(): { text: string; spokenText: string } {
  const tools = listToolMetadata();
  const lines = tools.map(
    (t) => `- ${t.name}@${t.version} [${t.risk}] — ${t.description}`,
  );
  const text = [`Atlas tool registry (${lines.length}):`, ...lines].join("\n");
  const names = tools.map((t) => t.name).join(", ");
  const spokenText =
    tools.length === 0
      ? "There are no registered tools yet."
      : `There are ${tools.length} registered tools: ${names}.`;
  return { text, spokenText };
}

export function buildUnknownText(request: NormalizedRequest): {
  text: string;
  spokenText: string;
} {
  const text = [
    "I could not classify that request yet.",
    `Received: "${request.text}"`,
    "Try: help · Open VS Code · Prepare my development environment",
  ].join("\n");
  const spokenText =
    "I could not classify that request yet. Try saying help, open VS Code, or prepare my development environment.";
  return { text, spokenText };
}
