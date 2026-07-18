export type {
  DetectResult,
  ProjectContextView,
  WorkspaceProject,
} from "./types.js";

export { projectToContext } from "./types.js";

export { detectProjectRoot, type DetectProjectRootOptions } from "./detect.js";

export {
  ACTIVE_PROJECT_PREF_KEY,
  WorkspaceManager,
  createWorkspaceManager,
  type DetectAndRegisterOptions,
  type WorkspaceManagerOptions,
} from "./manager.js";
