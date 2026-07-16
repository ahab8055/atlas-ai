/**
 * Model Runtime Manager — load/unload, sessions, memory control (Architecture/25).
 */
import { AiRuntimeError } from "../errors.js";
import type { InferenceProvider } from "../provider.js";
import type { ModelInfo } from "../types.js";
import {
  buildMemoryState,
  defaultMemoryBudgetBytes,
  estimateModelMemoryBytes,
  formatBytesShort,
} from "./memory.js";
import type {
  InferenceSession,
  LoadedModelState,
  ModelRuntimeManagerOptions,
  ModelRuntimePhase,
  ModelRuntimeSnapshot,
} from "./types.js";

const DEFAULT_IDLE_UNLOAD_MS = 5 * 60 * 1000;

export class ModelRuntimeManager {
  private readonly provider: InferenceProvider;
  private readonly maxLoadedModels: number;
  private readonly idleUnloadMs: number;
  private memoryBudgetBytes?: number;
  private hostMemory?: { totalBytes: number; freeBytes: number };
  private readonly resolveSizeBytes?: (modelId: string) => number | undefined;
  private readonly now: () => number;
  private readonly createSessionId: () => string;

  private phase: ModelRuntimePhase = "idle";
  private activeModelId?: string;
  private readonly loaded = new Map<string, LoadedModelState>();
  private readonly sessions = new Map<string, InferenceSession>();
  private lastError?: string;
  private loadChain: Promise<void> = Promise.resolve();

  constructor(
    provider: InferenceProvider,
    options: ModelRuntimeManagerOptions = {},
  ) {
    this.provider = provider;
    this.maxLoadedModels = Math.max(
      1,
      Math.floor(options.maxLoadedModels ?? 1),
    );
    this.idleUnloadMs =
      options.idleUnloadMs === undefined
        ? DEFAULT_IDLE_UNLOAD_MS
        : Math.max(0, Math.floor(options.idleUnloadMs));
    this.hostMemory = options.hostMemory;
    this.memoryBudgetBytes =
      options.memoryBudgetBytes ??
      defaultMemoryBudgetBytes(options.hostMemory?.totalBytes);
    this.resolveSizeBytes = options.resolveSizeBytes;
    this.now = options.now ?? (() => Date.now());
    this.createSessionId =
      options.createSessionId ??
      (() =>
        `sess_${this.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
  }

  getPhase(): ModelRuntimePhase {
    return this.phase;
  }

  getActiveModelId(): string | undefined {
    return this.activeModelId;
  }

  getSnapshot(): ModelRuntimeSnapshot {
    return {
      phase: this.phase,
      activeModelId: this.activeModelId,
      loaded: [...this.loaded.values()].map((m) => ({
        ...m,
        model: m.model ? { ...m.model } : undefined,
        sessionCount: this.countOpenSessions(m.modelId),
      })),
      sessions: [...this.sessions.values()].map((s) => ({ ...s })),
      memory: buildMemoryState([...this.loaded.values()], {
        budgetBytes: this.memoryBudgetBytes,
        hostFreeBytes: this.hostMemory?.freeBytes,
        hostTotalBytes: this.hostMemory?.totalBytes,
      }),
      idleUnloadMs: this.idleUnloadMs,
      maxLoadedModels: this.maxLoadedModels,
      lastError: this.lastError,
      updatedAt: new Date(this.now()).toISOString(),
    };
  }

  setHostMemory(host: { totalBytes: number; freeBytes: number }): void {
    this.hostMemory = host;
    if (this.memoryBudgetBytes === undefined) {
      this.memoryBudgetBytes = defaultMemoryBudgetBytes(host.totalBytes);
    }
  }

  setMemoryBudgetBytes(budgetBytes: number | undefined): void {
    this.memoryBudgetBytes =
      budgetBytes === undefined
        ? undefined
        : Math.max(0, Math.floor(budgetBytes));
  }

  /**
   * Load a model if needed. Evicts idle/other models to respect maxLoadedModels
   * and soft memory budget.
   */
  async ensureLoaded(modelId: string): Promise<ModelInfo> {
    const id = modelId.trim();
    if (!id) {
      throw new AiRuntimeError("modelId is required", {
        code: "model_id_required",
        provider: this.provider.id,
      });
    }

    return this.enqueue(async () => {
      const existing = this.loaded.get(id);
      if (existing?.model && existing.status === "ready") {
        this.touchModel(id);
        this.activeModelId = id;
        this.phase = "ready";
        return { ...existing.model };
      }

      await this.makeRoomFor(id);
      this.phase = "loading";
      this.lastError = undefined;
      const entry: LoadedModelState = {
        modelId: id,
        status: "loading",
        loadedAt: new Date(this.now()).toISOString(),
        lastUsedAt: new Date(this.now()).toISOString(),
        estimatedMemoryBytes: this.resolveSizeBytes?.(id),
        sessionCount: 0,
      };
      this.loaded.set(id, entry);

      try {
        const model = await this.provider.load(id);
        const estimated =
          estimateModelMemoryBytes({
            sizeBytes: model.sizeBytes ?? this.resolveSizeBytes?.(id),
          }) ?? entry.estimatedMemoryBytes;
        const ready: LoadedModelState = {
          ...entry,
          model: { ...model },
          status: "ready",
          estimatedMemoryBytes: estimated,
          lastUsedAt: new Date(this.now()).toISOString(),
        };
        this.loaded.set(id, ready);
        this.activeModelId = id;
        this.phase = "ready";
        return { ...model };
      } catch (error) {
        this.loaded.delete(id);
        this.phase = this.loaded.size > 0 ? "ready" : "idle";
        this.lastError = error instanceof Error ? error.message : String(error);
        throw error;
      }
    });
  }

  async unload(modelId?: string): Promise<void> {
    return this.enqueue(async () => {
      const id = modelId ?? this.activeModelId;
      if (!id) {
        await this.provider.unload();
        this.phase = "idle";
        return;
      }
      await this.unloadInternal(id, { force: true });
    });
  }

  async unloadAll(): Promise<void> {
    return this.enqueue(async () => {
      const ids = [...this.loaded.keys()];
      for (const id of ids) {
        await this.unloadInternal(id, { force: true });
      }
      await this.provider.unload();
      this.activeModelId = undefined;
      this.phase = "idle";
    });
  }

  /**
   * Unload ready models past idle TTL with no open sessions.
   * Returns ids that were unloaded.
   */
  async reclaimIdle(): Promise<string[]> {
    return this.enqueue(async () => {
      const unloaded: string[] = [];
      if (this.idleUnloadMs <= 0) {
        return unloaded;
      }
      const cutoff = this.now() - this.idleUnloadMs;
      for (const [id, state] of [...this.loaded.entries()]) {
        if (state.status !== "ready") {
          continue;
        }
        if (this.countOpenSessions(id) > 0) {
          continue;
        }
        const last = Date.parse(state.lastUsedAt);
        if (!Number.isFinite(last) || last > cutoff) {
          continue;
        }
        await this.unloadInternal(id, { force: false });
        unloaded.push(id);
      }
      return unloaded;
    });
  }

  /** Open an inference session; loads the model if needed. */
  async createSession(modelId: string): Promise<InferenceSession> {
    await this.ensureLoaded(modelId);
    const nowIso = new Date(this.now()).toISOString();
    const session: InferenceSession = {
      id: this.createSessionId(),
      modelId,
      status: "open",
      createdAt: nowIso,
      lastUsedAt: nowIso,
      inferenceCount: 0,
    };
    this.sessions.set(session.id, session);
    this.refreshSessionCount(modelId);
    return { ...session };
  }

  getSession(sessionId: string): InferenceSession | undefined {
    const s = this.sessions.get(sessionId);
    return s ? { ...s } : undefined;
  }

  listSessions(filter?: {
    status?: InferenceSession["status"];
    modelId?: string;
  }): InferenceSession[] {
    return [...this.sessions.values()]
      .filter((s) => {
        if (filter?.status && s.status !== filter.status) {
          return false;
        }
        if (filter?.modelId && s.modelId !== filter.modelId) {
          return false;
        }
        return true;
      })
      .map((s) => ({ ...s }));
  }

  endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === "closed") {
      return false;
    }
    session.status = "closed";
    session.lastUsedAt = new Date(this.now()).toISOString();
    this.refreshSessionCount(session.modelId);
    return true;
  }

  /** Mark model/session used (e.g. before/after generate). */
  touch(modelId: string, sessionId?: string): void {
    this.touchModel(modelId);
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session && session.status === "open") {
        session.lastUsedAt = new Date(this.now()).toISOString();
        session.inferenceCount += 1;
      }
    }
  }

  beginInference(modelId: string, sessionId?: string): void {
    this.touch(modelId, sessionId);
    const entry = this.loaded.get(modelId);
    if (entry) {
      entry.status = "busy";
    }
    this.phase = "busy";
    this.activeModelId = modelId;
  }

  endInference(modelId: string): void {
    const entry = this.loaded.get(modelId);
    if (entry) {
      entry.status = "ready";
      entry.lastUsedAt = new Date(this.now()).toISOString();
    }
    this.phase = this.loaded.size > 0 ? "ready" : "idle";
  }

  private async makeRoomFor(incomingId: string): Promise<void> {
    // Evict others when at capacity (single-slot default for llama.cpp)
    while (this.loaded.size >= this.maxLoadedModels) {
      const victim = this.pickEvictionVictim(incomingId);
      if (!victim) {
        break;
      }
      await this.unloadInternal(victim, { force: true });
    }

    // Soft memory budget: evict idle models until within budget (best-effort)
    const incomingSize = this.resolveSizeBytes?.(incomingId) ?? 0;
    if (this.memoryBudgetBytes !== undefined && incomingSize > 0) {
      let used =
        buildMemoryState([...this.loaded.values()], {
          budgetBytes: this.memoryBudgetBytes,
        }).estimatedUsedBytes + incomingSize;
      while (used > this.memoryBudgetBytes) {
        const victim = this.pickEvictionVictim(incomingId);
        if (!victim) {
          break;
        }
        const size = this.loaded.get(victim)?.estimatedMemoryBytes ?? 0;
        await this.unloadInternal(victim, { force: true });
        used -= size;
      }
    }
  }

  private pickEvictionVictim(exceptId: string): string | undefined {
    let best: { id: string; last: number } | undefined;
    for (const [id, state] of this.loaded) {
      if (id === exceptId) {
        continue;
      }
      if (this.countOpenSessions(id) > 0) {
        continue;
      }
      if (state.status === "busy" || state.status === "loading") {
        continue;
      }
      const last = Date.parse(state.lastUsedAt);
      if (!best || last < best.last) {
        best = { id, last };
      }
    }
    // If all have sessions but we must make room (maxLoadedModels), force oldest
    if (!best && this.loaded.size >= this.maxLoadedModels) {
      for (const [id, state] of this.loaded) {
        if (id === exceptId) {
          continue;
        }
        const last = Date.parse(state.lastUsedAt);
        if (!best || last < best.last) {
          best = { id, last };
        }
      }
    }
    return best?.id;
  }

  private async unloadInternal(
    modelId: string,
    opts: { force: boolean },
  ): Promise<void> {
    const entry = this.loaded.get(modelId);
    if (!entry) {
      return;
    }
    if (!opts.force && this.countOpenSessions(modelId) > 0) {
      return;
    }
    // Close sessions on force unload
    if (opts.force) {
      for (const session of this.sessions.values()) {
        if (session.modelId === modelId && session.status === "open") {
          session.status = "closed";
        }
      }
    }
    this.phase = "unloading";
    entry.status = "unloading";
    try {
      await this.provider.unload();
    } finally {
      this.loaded.delete(modelId);
      if (this.activeModelId === modelId) {
        this.activeModelId = undefined;
      }
      this.phase = this.loaded.size > 0 ? "ready" : "idle";
    }
  }

  private touchModel(modelId: string): void {
    const entry = this.loaded.get(modelId);
    if (entry) {
      entry.lastUsedAt = new Date(this.now()).toISOString();
      entry.sessionCount = this.countOpenSessions(modelId);
    }
  }

  private countOpenSessions(modelId: string): number {
    let n = 0;
    for (const s of this.sessions.values()) {
      if (s.modelId === modelId && s.status === "open") {
        n += 1;
      }
    }
    return n;
  }

  private refreshSessionCount(modelId: string): void {
    const entry = this.loaded.get(modelId);
    if (entry) {
      entry.sessionCount = this.countOpenSessions(modelId);
    }
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.loadChain.then(fn, fn);
    this.loadChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

export function createModelRuntimeManager(
  provider: InferenceProvider,
  options?: ModelRuntimeManagerOptions,
): ModelRuntimeManager {
  return new ModelRuntimeManager(provider, options);
}

export function formatRuntimeSnapshot(snapshot: ModelRuntimeSnapshot): string {
  const lines = [
    `Runtime: ${snapshot.phase}`,
    ...(snapshot.activeModelId
      ? [`Active model: ${snapshot.activeModelId}`]
      : ["Active model: (none)"]),
    `Loaded: ${snapshot.loaded.length}/${snapshot.maxLoadedModels}`,
    `Idle unload: ${snapshot.idleUnloadMs > 0 ? `${snapshot.idleUnloadMs}ms` : "disabled"}`,
    `Memory: ${formatBytesShort(snapshot.memory.estimatedUsedBytes)} used` +
      (snapshot.memory.budgetBytes !== undefined
        ? ` / ${formatBytesShort(snapshot.memory.budgetBytes)} budget` +
          (snapshot.memory.withinBudget ? " (ok)" : " (OVER)")
        : ""),
  ];
  if (snapshot.loaded.length > 0) {
    lines.push("Models:");
    for (const m of snapshot.loaded) {
      const mem =
        m.estimatedMemoryBytes !== undefined
          ? ` ${formatBytesShort(m.estimatedMemoryBytes)}`
          : "";
      lines.push(
        `  - ${m.modelId} [${m.status}] sessions=${m.sessionCount}${mem} lastUsed=${m.lastUsedAt}`,
      );
    }
  }
  const open = snapshot.sessions.filter((s) => s.status === "open");
  lines.push(`Open sessions: ${open.length}`);
  for (const s of open) {
    lines.push(`  - ${s.id} model=${s.modelId} inferences=${s.inferenceCount}`);
  }
  if (snapshot.lastError) {
    lines.push(`Last error: ${snapshot.lastError}`);
  }
  return lines.join("\n");
}
