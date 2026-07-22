import { defineTool, registerBuiltin } from "./define.js";
import {
  fileCopy,
  fileDelete,
  fileExists,
  fileList,
  fileMetadata,
  fileMkdir,
  fileMove,
  fileRead,
  fileRename,
  fileResolve,
  fileRestore,
  fileRmdir,
  fileSearch,
  fileWalk,
  fileWrite,
} from "./file-tools.js";

export { defineTool, registerBuiltin } from "./define.js";

const systemInfo = defineTool(
  {
    name: "system.info",
    description: "Report Atlas runtime / system information",
    version: "1.0.0",
    permissions: ["system.info"],
    risk: "low",
    tags: ["system", "mvp"],
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Input source label" },
      },
      additionalProperties: true,
    },
    outputSchema: {
      type: "object",
      required: ["message"],
      properties: {
        message: { type: "string" },
      },
    },
  },
  (input, context) => {
    const source = String(input.source ?? context.source ?? "unknown");
    const message = `Atlas core OK (source=${source})`;
    return { ok: true, message, data: { message, source } };
  },
);

const echo = defineTool(
  {
    name: "echo",
    description: "Echo text through the tool system",
    version: "1.0.0",
    permissions: [],
    risk: "low",
    tags: ["system", "mvp"],
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" },
      },
    },
  },
  (input) => {
    const text = String(input.text ?? "");
    return { ok: true, message: text, data: { text } };
  },
);

const applicationOpen = defineTool(
  {
    name: "application.open",
    description: "Open or launch an application",
    version: "1.0.0",
    permissions: ["application.control"],
    risk: "high",
    tags: ["application", "mvp"],
    inputSchema: {
      type: "object",
      required: ["application"],
      properties: {
        application: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message"],
      properties: {
        message: { type: "string" },
        application: { type: "string" },
      },
    },
  },
  (input) => {
    const application = String(input.application ?? "unknown");
    const message = `Application Control: would open "${application}" (launcher not wired yet).`;
    return { ok: true, message, data: { message, application } };
  },
);

const codeAnalyze = defineTool(
  {
    name: "code.analyze",
    description: "Analyze or explain code",
    version: "1.0.0",
    permissions: ["filesystem.read"],
    risk: "medium",
    tags: ["code", "mvp"],
    inputSchema: {
      type: "object",
      required: ["target"],
      properties: {
        target: { type: "string" },
        focus: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message"],
      properties: {
        message: { type: "string" },
        target: { type: "string" },
      },
    },
  },
  (input) => {
    const target = String(input.target ?? "");
    const message = `Code Analysis: would explain "${target}" (analyzer not wired yet).`;
    return { ok: true, message, data: { message, target } };
  },
);

const projectOpen = defineTool(
  {
    name: "project.open",
    description: "Open a project in the workspace",
    version: "1.0.0",
    permissions: ["filesystem.read"],
    risk: "medium",
    tags: ["project", "mvp"],
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: {
        project: { type: "string" },
        path: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message"],
      properties: {
        message: { type: "string" },
        project: { type: "string" },
      },
    },
  },
  (input) => {
    const project = String(input.project ?? "project");
    const path = input.path ? ` at ${String(input.path)}` : "";
    const message = `Project: would open "${project}"${path} (project tool not wired yet).`;
    return { ok: true, message, data: { message, project } };
  },
);

const processStart = defineTool(
  {
    name: "process.start",
    description: "Start a process or development service",
    version: "1.0.0",
    permissions: ["terminal.execute"],
    risk: "high",
    tags: ["terminal", "mvp"],
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        command: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message"],
      properties: {
        message: { type: "string" },
        name: { type: "string" },
      },
    },
  },
  (input) => {
    const name = String(input.name ?? "process");
    const command = String(input.command ?? "");
    const message = `Process: would start ${name}${command ? ` (${command})` : ""} (process tool not wired yet).`;
    return { ok: true, message, data: { message, name, command } };
  },
);

/** MVP tools — register themselves on the default registry. */
export const BUILTIN_TOOLS = [
  systemInfo,
  echo,
  applicationOpen,
  fileSearch,
  fileRead,
  fileWrite,
  fileMkdir,
  fileDelete,
  fileMove,
  fileCopy,
  fileRename,
  fileRestore,
  fileRmdir,
  fileExists,
  fileResolve,
  fileList,
  fileWalk,
  fileMetadata,
  codeAnalyze,
  projectOpen,
  processStart,
] as const;

export function registerBuiltinTools(): void {
  for (const tool of BUILTIN_TOOLS) {
    registerBuiltin(tool);
  }
}
