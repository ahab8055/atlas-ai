import type {
  ContextContribution,
  ContextProvider,
  ProjectContext,
} from "../types.js";

export type ProjectContextLoader = () => ProjectContext | undefined;

/**
 * Project context provider — loader supplies active workspace project (ADR-0051).
 * Without a loader, returns a minimal stub for offline/no-db runs.
 */
export function createProjectProvider(
  load?: ProjectContextLoader,
): ContextProvider {
  return {
    id: "project",
    load() {
      const project = load?.() ?? { name: "Atlas AI" };
      return {
        source: "project",
        project,
      } satisfies ContextContribution;
    },
  };
}
