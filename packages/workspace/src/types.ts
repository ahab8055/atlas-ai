import type { ProjectRow } from "@atlas-ai/database";

/** Core-compatible project context without depending on @atlas-ai/core. */
export interface ProjectContextView {
  id?: string;
  name?: string;
  path?: string;
  repoUrl?: string;
  defaultBranch?: string;
}

export interface DetectResult {
  rootPath: string;
  name: string;
  kind: "git" | "marker";
  marker?: string;
  repoUrl?: string;
  defaultBranch?: string;
}

export type WorkspaceProject = ProjectRow;

export function projectToContext(project: ProjectRow): ProjectContextView {
  return {
    id: project.id,
    name: project.name,
    path: project.path,
    repoUrl: project.repoUrl,
    defaultBranch: project.defaultBranch,
  };
}
