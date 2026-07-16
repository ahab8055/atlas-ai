import { describe, expect, it } from "vitest";

import {
  MockEmbeddingProvider,
  cosineSimilarity,
  createEmbeddingService,
  createPersistentEmbeddingStore,
  hashTextToVector,
  serializeEmbedding,
  deserializeEmbedding,
} from "./index.js";
import { InMemoryEmbeddingStore } from "./memory-store.js";

describe("embedding vectors", () => {
  it("serializes and deserializes float32 blobs", () => {
    const v = [0.1, -0.5, 2.25];
    const round = deserializeEmbedding(serializeEmbedding(v));
    expect(round).toHaveLength(3);
    expect(round[0]).toBeCloseTo(0.1, 5);
    expect(round[1]).toBeCloseTo(-0.5, 5);
  });

  it("produces stable mock vectors and cosine similarity", () => {
    const a = hashTextToVector("hello atlas", 32);
    const b = hashTextToVector("hello atlas", 32);
    const c = hashTextToVector("totally different text", 32);
    expect(a).toEqual(b);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
    expect(cosineSimilarity(a, c)).toBeLessThan(0.99);
  });
});

describe("EmbeddingService", () => {
  it("generates embeddings locally without chat models", async () => {
    const provider = new MockEmbeddingProvider();
    const service = createEmbeddingService({
      provider,
      defaultModelId: "mock-embed-384",
    });

    expect(service.getProviderId()).toBe("mock-embeddings");
    expect(service.getProviderId()).not.toBe("mock");

    const result = await service.embed("semantic search query");
    expect(result.dimensions).toBe(384);
    expect(result.provider).toBe("mock-embeddings");
    expect(result.embedding).toHaveLength(384);
  });

  it("stores embeddings and supports similarity for future retrieval", async () => {
    const store = new InMemoryEmbeddingStore();
    const service = createEmbeddingService({
      provider: new MockEmbeddingProvider(),
      store,
    });

    const mem = await service.embedAndStore(
      "I use TypeScript and Vitest for Atlas",
      { collection: "memory", source: "preference" },
    );
    await service.embedAndStore("The weather is sunny today", {
      collection: "memory",
    });

    expect(service.list({ collection: "memory" })).toHaveLength(2);
    expect(service.get(mem.id)?.content).toContain("TypeScript");

    const matches = await service.findSimilar("TypeScript testing setup", {
      collection: "memory",
      limit: 2,
    });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.record.id).toBe(mem.id);
    expect(matches[0]?.score).toBeGreaterThan(0);
  });

  it("bridges persistent store API shape", () => {
    const rows = new Map<string, ReturnType<typeof createRow>>();
    function createRow(input: {
      id?: string;
      content: string;
      embedding: Buffer;
      dimensions: number;
      modelId: string;
      provider: string;
      collection?: string;
    }) {
      const id = input.id ?? "e1";
      const now = new Date().toISOString();
      return {
        id,
        content: input.content,
        embedding: input.embedding,
        dimensions: input.dimensions,
        modelId: input.modelId,
        provider: input.provider,
        collection: input.collection ?? "general",
        metadata: {},
        createdAt: now,
        updatedAt: now,
      };
    }
    const api = {
      upsert(input: Parameters<typeof createRow>[0]) {
        const row = createRow(input);
        rows.set(row.id, row);
        return row;
      },
      get(id: string) {
        return rows.get(id);
      },
      list() {
        return [...rows.values()];
      },
      remove(id: string) {
        return rows.delete(id);
      },
    };
    const store = createPersistentEmbeddingStore(api);
    const saved = store.upsert({
      content: "hi",
      embedding: [0.2, 0.3, 0.4],
      modelId: "m",
      provider: "mock-embeddings",
    });
    expect(store.get(saved.id)?.dimensions).toBe(3);
  });
});

describe("HttpEmbeddingProvider", () => {
  it("calls /v1/embeddings independently of chat", async () => {
    const { HttpEmbeddingProvider } = await import("./http.js");
    const provider = new HttpEmbeddingProvider({
      baseUrl: "http://embed.test",
      defaultModelId: "bge-small",
      fetch: async (input, init) => {
        const url = String(input);
        if (url.endsWith("/v1/embeddings")) {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            model: string;
            input: string;
          };
          expect(body.model).toBe("bge-small");
          expect(body.input).toBe("hello");
          return Response.json({
            model: "bge-small",
            data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
          });
        }
        return new Response("no", { status: 404 });
      },
    });

    const result = await provider.embed({ text: "hello" });
    expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(result.provider).toBe("llamacpp-embeddings");
  });
});
