/**
 * Workspace / project registry facade (ADR-0051).
 */
import type {
  ProjectRow,
  ProjectsRepository,
  UserPreferencesRepository,
} from "@atlas-ai/database";

import { detectProjectRoot } from "./detect.js";
import {
  projectToContext,
  type DetectResult,
  type ProjectContextView,
} from "./types.js";

const ACTIVE_PROJECT_PREF_KEY = "active_project_id";

export interface WorkspaceManagerOptions {
  projects: ProjectsRepository;
  preferences?: UserPreferencesRepository;
  userId?: string;
}

export interface DetectAndRegisterOptions {
  cwd?: string;
  remember?: boolean;
}

export class WorkspaceManager {
  private readonly projects: ProjectsRepository;
  private readonly preferences?: UserPreferencesRepository;
  private readonly userId: string;
  private activeId?: string;

  constructor(options: WorkspaceManagerOptions) {
    this.projects = options.projects;
    this.preferences = options.preferences;
    this.userId = options.userId ?? "local";

    const stored = this.preferences?.get(ACTIVE_PROJECT_PREF_KEY, this.userId);
    if (stored && this.projects.get(stored)) {
      this.activeId = stored;
    }
  }

  detect(cwd?: string): DetectResult | undefined {
    return detectProjectRoot(cwd ?? process.cwd());
  }

  detectAndRegister(
    options: DetectAndRegisterOptions = {},
  ): ProjectRow | undefined {
    const detected = this.detect(options.cwd);
    if (!detected) {
      return undefined;
    }
    if (options.remember === false) {
      return undefined;
    }
    const row = this.projects.upsertByPath({
      userId: this.userId,
      name: detected.name,
      path: detected.rootPath,
      repoUrl: detected.repoUrl ?? null,
      defaultBranch: detected.defaultBranch ?? null,
      metadata: {
        kind: detected.kind,
        marker: detected.marker,
      },
    });
    this.setActive(row.id);
    return row;
  }

  list(limit = 100): ProjectRow[] {
    return this.projects.list({ userId: this.userId, limit });
  }

  get(id: string): ProjectRow | undefined {
    return this.projects.get(id);
  }

  getByPath(path: string): ProjectRow | undefined {
    return this.projects.getByPath(path, this.userId);
  }

  getActive(): ProjectRow | undefined {
    if (!this.activeId) {
      return undefined;
    }
    return this.projects.get(this.activeId);
  }

  getActiveContext(): ProjectContextView | undefined {
    const active = this.getActive();
    return active ? projectToContext(active) : undefined;
  }

  setActive(idOrPath: string): ProjectRow | undefined {
    let row = this.projects.get(idOrPath);
    if (!row) {
      row = this.projects.getByPath(idOrPath, this.userId);
    }
    if (!row) {
      return undefined;
    }
    this.activeId = row.id;
    this.projects.touch(row.id);
    this.preferences?.set(ACTIVE_PROJECT_PREF_KEY, row.id, {
      userId: this.userId,
      category: "workspace",
      source: "manual",
    });
    return row;
  }

  clearActive(): void {
    this.activeId = undefined;
    this.preferences?.delete(ACTIVE_PROJECT_PREF_KEY, this.userId);
  }
}

export function createWorkspaceManager(
  projects: ProjectsRepository,
  preferences?: UserPreferencesRepository,
  userId = "local",
): WorkspaceManager {
  return new WorkspaceManager({ projects, preferences, userId });
}

export { ACTIVE_PROJECT_PREF_KEY };
