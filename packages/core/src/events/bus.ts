import { randomUUID } from "node:crypto";

import type {
  AtlasEvent,
  EventHandler,
  PublishInput,
  Unsubscribe,
} from "./types.js";

const WILDCARD = "*";

export interface EventBusOptions {
  /** Retain published events in memory (default 200). Set 0 to disable. */
  historyLimit?: number;
}

/**
 * In-process event bus foundation (Architecture/10).
 * Components publish and subscribe without direct dependencies.
 */
export class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly history: AtlasEvent[] = [];
  private readonly historyLimit: number;

  constructor(options: EventBusOptions = {}) {
    this.historyLimit = options.historyLimit ?? 200;
  }

  /**
   * Subscribe to an event type, or `"*"` for all events.
   * Returns an unsubscribe function.
   */
  subscribe(type: string, handler: EventHandler): Unsubscribe {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
      if (set && set.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  /** Subscribe once; auto-unsubscribes after the first matching event. */
  once(type: string, handler: EventHandler): Unsubscribe {
    const unsubscribe = this.subscribe(type, (event) => {
      unsubscribe();
      handler(event);
    });
    return unsubscribe;
  }

  /** Publish an event to matching subscribers (specific type + wildcard). */
  publish<TType extends string, TPayload extends Record<string, unknown>>(
    input: PublishInput<TType, TPayload>,
  ): AtlasEvent<TType, TPayload> {
    const event: AtlasEvent<TType, TPayload> = {
      id: input.id ?? `evt_${randomUUID()}`,
      type: input.type,
      timestamp: input.timestamp ?? new Date().toISOString(),
      source: input.source,
      traceId: input.traceId,
      payload: input.payload,
    };

    this.record(event as AtlasEvent);

    const specific = this.handlers.get(event.type);
    const wildcard = this.handlers.get(WILDCARD);
    const delivered = new Set<EventHandler>();

    for (const handler of specific ?? []) {
      delivered.add(handler);
      handler(event as AtlasEvent);
    }
    for (const handler of wildcard ?? []) {
      if (!delivered.has(handler)) {
        handler(event as AtlasEvent);
      }
    }

    return event;
  }

  /** Number of listeners for a type (omit for all listeners). */
  listenerCount(type?: string): number {
    if (type) {
      return this.handlers.get(type)?.size ?? 0;
    }
    let total = 0;
    for (const set of this.handlers.values()) {
      total += set.size;
    }
    return total;
  }

  /** Recent published events (newest last). */
  getHistory(): readonly AtlasEvent[] {
    return this.history;
  }

  clearHistory(): void {
    this.history.length = 0;
  }

  /** Remove all subscribers (does not clear history). */
  clearSubscribers(): void {
    this.handlers.clear();
  }

  private record(event: AtlasEvent): void {
    if (this.historyLimit <= 0) {
      return;
    }
    this.history.push(event);
    while (this.history.length > this.historyLimit) {
      this.history.shift();
    }
  }
}

let defaultBus: EventBus | undefined;

export function getDefaultEventBus(): EventBus {
  defaultBus ??= new EventBus();
  return defaultBus;
}

export function setDefaultEventBus(bus: EventBus): void {
  defaultBus = bus;
}
