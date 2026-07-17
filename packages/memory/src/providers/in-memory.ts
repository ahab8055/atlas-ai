/**
 * Isolated in-memory providers — one Map store per MemoryType.
 */
import type { MemoryProvider } from "../provider.js";
import type {
  ClearMemoryOptions,
  CreateMemoryInput,
  MemoryQuery,
  MemoryRecord,
  MemoryType,
  UpdateMemoryInput,
} from "../types.js";
import { InMemoryStore } from "./in-memory-store.js";

abstract class BaseInMemoryMemoryProvider implements MemoryProvider {
  abstract readonly type: MemoryType;
  private readonly backend: InMemoryStore;

  constructor(type: MemoryType) {
    this.backend = new InMemoryStore(type);
  }

  store(input: CreateMemoryInput): Promise<MemoryRecord> {
    return this.backend.store(input);
  }

  get(id: string): Promise<MemoryRecord | undefined> {
    return this.backend.get(id);
  }

  update(id: string, patch: UpdateMemoryInput): Promise<MemoryRecord> {
    return this.backend.update(id, patch);
  }

  delete(id: string): Promise<boolean> {
    return this.backend.delete(id);
  }

  query(query: MemoryQuery): Promise<MemoryRecord[]> {
    return this.backend.query(query);
  }

  clear(options?: ClearMemoryOptions): Promise<number> {
    return this.backend.clear(options);
  }
}

export class InMemoryWorkingMemoryProvider extends BaseInMemoryMemoryProvider {
  readonly type = "working" as const;

  constructor() {
    super("working");
  }
}

export class InMemoryEpisodicMemoryProvider extends BaseInMemoryMemoryProvider {
  readonly type = "episodic" as const;

  constructor() {
    super("episodic");
  }
}

export class InMemorySemanticMemoryProvider extends BaseInMemoryMemoryProvider {
  readonly type = "semantic" as const;

  constructor() {
    super("semantic");
  }
}

export class InMemoryProceduralMemoryProvider extends BaseInMemoryMemoryProvider {
  readonly type = "procedural" as const;

  constructor() {
    super("procedural");
  }
}
