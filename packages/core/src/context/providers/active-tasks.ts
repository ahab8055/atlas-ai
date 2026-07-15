import type { ActiveTaskStore } from "../task-store.js";
import type { ContextContribution, ContextProvider } from "../types.js";

export function createActiveTasksProvider(
  store: ActiveTaskStore,
): ContextProvider {
  return {
    id: "active_tasks",
    load() {
      return {
        source: "active_tasks",
        activeTasks: store.list(),
      } satisfies ContextContribution;
    },
  };
}
