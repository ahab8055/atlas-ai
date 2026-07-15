import type { ActiveTask } from "./types.js";

/**
 * Active task list for working-memory style context.
 * Later: workflow engine writes here.
 */
export interface ActiveTaskStore {
  list(): ActiveTask[];
  upsert(task: ActiveTask): void;
  remove(id: string): void;
  clear(): void;
}

export class InMemoryActiveTaskStore implements ActiveTaskStore {
  private readonly tasks = new Map<string, ActiveTask>();

  list(): ActiveTask[] {
    return [...this.tasks.values()];
  }

  upsert(task: ActiveTask): void {
    this.tasks.set(task.id, task);
  }

  remove(id: string): void {
    this.tasks.delete(id);
  }

  clear(): void {
    this.tasks.clear();
  }
}
