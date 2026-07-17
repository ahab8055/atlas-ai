/**
 * Pluggable memory backend per MemoryType (Architecture/04).
 * Core / managers depend on this port — not on store internals.
 */
import type {
  ClearMemoryOptions,
  CreateMemoryInput,
  MemoryQuery,
  MemoryRecord,
  MemoryType,
  UpdateMemoryInput,
} from "./types.js";

export interface MemoryProvider {
  readonly type: MemoryType;

  store(input: CreateMemoryInput): Promise<MemoryRecord>;

  get(id: string): Promise<MemoryRecord | undefined>;

  update(id: string, patch: UpdateMemoryInput): Promise<MemoryRecord>;

  delete(id: string): Promise<boolean>;

  query(query: MemoryQuery): Promise<MemoryRecord[]>;

  clear(options?: ClearMemoryOptions): Promise<number>;
}
