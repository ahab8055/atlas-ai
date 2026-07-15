import type { ContextContribution, ContextProvider } from "../types.js";

/** Project context stub — later from workspace / active project detection. */
export function createProjectProvider(): ContextProvider {
  return {
    id: "project",
    load() {
      return {
        source: "project",
        project: {
          name: "Atlas AI",
        },
      } satisfies ContextContribution;
    },
  };
}
