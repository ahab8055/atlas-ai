import { draftStep } from "./builders.js";
import type { PlanTemplate } from "./types.js";

const helpTemplate: PlanTemplate = {
  intentName: "help",
  priority: 100,
  build() {
    return {
      goal: "Show available commands",
      requiresApproval: false,
      steps: [draftStep("help", "Show available commands")],
    };
  },
};

const statusTemplate: PlanTemplate = {
  intentName: "system.status",
  priority: 100,
  build() {
    return {
      goal: "Report Atlas runtime status",
      requiresApproval: false,
      steps: [
        draftStep("status", "Read runtime status", {
          tool: "system.info",
          capability: "system.info",
        }),
      ],
    };
  },
};

const echoTemplate: PlanTemplate = {
  intentName: "echo",
  priority: 100,
  build({ intent }) {
    return {
      goal: "Echo text through the pipeline",
      requiresApproval: false,
      steps: [
        draftStep("echo", "Echo user text", {
          tool: "echo",
          args: { text: String(intent.parameters.text ?? "(empty)") },
        }),
      ],
    };
  },
};

const applicationOpenTemplate: PlanTemplate = {
  intentName: "application.open",
  priority: 100,
  build({ intent }) {
    const application = String(intent.parameters.application ?? "");
    return {
      goal: intent.goal,
      requiresApproval: true,
      steps: [
        draftStep("open-app", intent.goal, {
          tool: "application.open",
          capability: "application.control",
          args: { application },
        }),
      ],
    };
  },
};

const fileSearchTemplate: PlanTemplate = {
  intentName: "file.search",
  priority: 100,
  build({ intent }) {
    const query = String(
      intent.parameters.query ?? intent.parameters.keyword ?? "",
    );
    return {
      goal: intent.goal,
      requiresApproval: true,
      steps: [
        draftStep("search-files", intent.goal, {
          tool: "file.search",
          capability: "filesystem.read",
          args: { query },
        }),
      ],
    };
  },
};

const codeAnalyzeTemplate: PlanTemplate = {
  intentName: "code.analyze",
  priority: 100,
  build({ intent }) {
    return {
      goal: intent.goal,
      requiresApproval: true,
      steps: [
        draftStep("analyze-code", intent.goal, {
          tool: "code.analyze",
          capability: "filesystem.read",
          args: {
            target: String(intent.parameters.target ?? ""),
            focus: String(intent.parameters.focus ?? "explain"),
          },
        }),
      ],
    };
  },
};

/**
 * Multi-step: prepare development environment.
 * Open VS Code → open project → start backend → start frontend.
 */
const envSetupTemplate: PlanTemplate = {
  intentName: "environment.setup",
  priority: 100,
  build({ intent, context }) {
    const editor =
      String(intent.parameters.editor ?? context.preferences.preferredEditor) ||
      "VS Code";
    const projectName =
      String(intent.parameters.project ?? context.project?.name) || "Atlas AI";
    const projectPath = context.project?.path;

    return {
      goal: `Prepare development environment for ${projectName}`,
      requiresApproval: true,
      steps: [
        draftStep("open-editor", `Open ${editor}`, {
          tool: "application.open",
          capability: "application.control",
          args: { application: editor },
        }),
        draftStep("open-project", `Open project ${projectName}`, {
          tool: "project.open",
          capability: "filesystem.read",
          args: {
            project: projectName,
            ...(projectPath ? { path: projectPath } : {}),
          },
        }),
        draftStep("start-backend", "Start backend service", {
          tool: "process.start",
          capability: "terminal.execute",
          args: { name: "backend", command: "pnpm dev:backend" },
        }),
        draftStep("start-frontend", "Start frontend service", {
          tool: "process.start",
          capability: "terminal.execute",
          args: { name: "frontend", command: "pnpm dev:web" },
        }),
      ],
    };
  },
};

const unknownTemplate: PlanTemplate = {
  intentName: "unknown",
  priority: 1,
  build({ request }) {
    return {
      goal: "Acknowledge unrecognized intent",
      requiresApproval: false,
      steps: [
        draftStep("unknown", "Acknowledge unrecognized intent", {
          args: { text: request.text },
        }),
      ],
    };
  },
};

export const BUILTIN_PLAN_TEMPLATES: readonly PlanTemplate[] = [
  helpTemplate,
  statusTemplate,
  echoTemplate,
  applicationOpenTemplate,
  fileSearchTemplate,
  codeAnalyzeTemplate,
  envSetupTemplate,
  unknownTemplate,
];
