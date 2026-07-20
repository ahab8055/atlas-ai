import { describe, expect, it } from "vitest";
import {
  applyEnvOverrides,
  mergeAppConfig,
  parseEnvironment,
} from "./merge.js";
import { DEFAULT_APP_CONFIG } from "./defaults.js";
import { loadConfig } from "./load.js";
import { resolve } from "node:path";

describe("parseEnvironment", () => {
  it("accepts known environments", () => {
    expect(parseEnvironment("production")).toBe("production");
    expect(parseEnvironment("test")).toBe("test");
  });

  it("falls back to development for unknown values", () => {
    expect(parseEnvironment("staging")).toBe("development");
    expect(parseEnvironment(undefined)).toBe("development");
  });
});

describe("applyEnvOverrides", () => {
  it("overrides log level from ATLAS_LOG_LEVEL", () => {
    const next = applyEnvOverrides(DEFAULT_APP_CONFIG, {
      ATLAS_LOG_LEVEL: "debug",
    });
    expect(next.logLevel).toBe("debug");
  });

  it("overrides inference temperature tokens context and stream", () => {
    const next = applyEnvOverrides(DEFAULT_APP_CONFIG, {
      ATLAS_AI_TEMPERATURE: "0.2",
      ATLAS_AI_MAX_TOKENS: "512",
      ATLAS_AI_CONTEXT_SIZE: "8192",
      ATLAS_AI_STREAM: "false",
    });
    expect(next.ai.inference.temperature).toBe(0.2);
    expect(next.ai.inference.maxTokens).toBe(512);
    expect(next.ai.inference.stream).toBe(false);
    expect(next.ai.hardware.contextSize).toBe(8192);
  });

  it("overrides short-term memory window and ttl", () => {
    const next = applyEnvOverrides(DEFAULT_APP_CONFIG, {
      ATLAS_MEMORY_SHORT_TERM_MAX_ENTRIES: "12",
      ATLAS_MEMORY_SHORT_TERM_TTL_MS: "60000",
    });
    expect(next.memory.shortTerm.maxEntries).toBe(12);
    expect(next.memory.shortTerm.ttlMs).toBe(60000);
  });

  it("overrides memory classification thresholds", () => {
    const next = applyEnvOverrides(DEFAULT_APP_CONFIG, {
      ATLAS_MEMORY_CLASSIFY_MIN_IMPORTANCE: "0.5",
      ATLAS_MEMORY_CLASSIFY_MIN_CONFIDENCE: "0.4",
      ATLAS_MEMORY_CLASSIFY_TEMPORARY_TTL_MS: "3600000",
    });
    expect(next.memory.classification.minImportanceToStore).toBe(0.5);
    expect(next.memory.classification.minConfidenceToStore).toBe(0.4);
    expect(next.memory.classification.temporaryTtlMs).toBe(3600000);
  });

  it("overrides memory retrieval settings", () => {
    const next = applyEnvOverrides(DEFAULT_APP_CONFIG, {
      ATLAS_MEMORY_RETRIEVAL_LIMIT: "8",
      ATLAS_MEMORY_RETRIEVAL_MIN_SCORE: "0.2",
      ATLAS_MEMORY_RETRIEVAL_RECENCY_HALFLIFE_MS: "86400000",
    });
    expect(next.memory.retrieval.limit).toBe(8);
    expect(next.memory.retrieval.minScore).toBe(0.2);
    expect(next.memory.retrieval.recencyHalfLifeMs).toBe(86400000);
  });

  it("overrides memory consolidation settings", () => {
    const next = applyEnvOverrides(DEFAULT_APP_CONFIG, {
      ATLAS_MEMORY_CONSOLIDATE_MERGE_MIN_SCORE: "0.8",
      ATLAS_MEMORY_CONSOLIDATE_CONFLICT_MIN_SCORE: "0.6",
      ATLAS_MEMORY_CONSOLIDATE_CANDIDATE_LIMIT: "5",
      ATLAS_MEMORY_CONSOLIDATE_ON_STORE: "false",
    });
    expect(next.memory.consolidation.mergeMinScore).toBe(0.8);
    expect(next.memory.consolidation.conflictMinScore).toBe(0.6);
    expect(next.memory.consolidation.candidateLimit).toBe(5);
    expect(next.memory.consolidation.consolidateOnStore).toBe(false);
  });

  it("overrides knowledge extraction settings from env", () => {
    const next = applyEnvOverrides(DEFAULT_APP_CONFIG, {
      ATLAS_KNOWLEDGE_EXTRACTION_ENABLED: "false",
      ATLAS_KNOWLEDGE_EXTRACTION_MIN_CONFIDENCE: "0.7",
      ATLAS_KNOWLEDGE_EXTRACT_ON_REQUEST: "false",
      ATLAS_KNOWLEDGE_AUTO_LINK_ON_EXTRACT: "false",
      ATLAS_KNOWLEDGE_REINFORCE_ON_LINK: "false",
      ATLAS_KNOWLEDGE_REINFORCE_STEP: "0.1",
      ATLAS_KNOWLEDGE_RETRIEVAL_LIMIT: "4",
      ATLAS_KNOWLEDGE_RETRIEVAL_MIN_SCORE: "0.3",
      ATLAS_KNOWLEDGE_RETRIEVAL_MAX_DEPTH: "1",
      ATLAS_KNOWLEDGE_RETRIEVAL_RECENCY_HALFLIFE_MS: "86400000",
    });
    expect(next.knowledge.extraction.enabled).toBe(false);
    expect(next.knowledge.extraction.minConfidence).toBe(0.7);
    expect(next.knowledge.extraction.extractOnRequest).toBe(false);
    expect(next.knowledge.relationships.autoLinkOnExtract).toBe(false);
    expect(next.knowledge.relationships.reinforceOnLink).toBe(false);
    expect(next.knowledge.relationships.reinforceStep).toBe(0.1);
    expect(next.knowledge.retrieval.limit).toBe(4);
    expect(next.knowledge.retrieval.minScore).toBe(0.3);
    expect(next.knowledge.retrieval.maxDepth).toBe(1);
    expect(next.knowledge.retrieval.recencyHalfLifeMs).toBe(86_400_000);
  });

  it("overrides profile learning settings from env", () => {
    const next = applyEnvOverrides(DEFAULT_APP_CONFIG, {
      ATLAS_PROFILE_LEARNING_ENABLED: "false",
      ATLAS_PROFILE_LEARN_ON_REQUEST: "false",
      ATLAS_PROFILE_LEARN_MIN_CONFIDENCE: "0.7",
    });
    expect(next.profile.learning.enabled).toBe(false);
    expect(next.profile.learning.learnOnRequest).toBe(false);
    expect(next.profile.learning.minConfidence).toBe(0.7);
  });

  it("overrides platform force id and feature flags from env", () => {
    const next = applyEnvOverrides(DEFAULT_APP_CONFIG, {
      ATLAS_PLATFORM_FORCE_ID: "darwin",
      ATLAS_PLATFORM_FEATURE_OS_PERMISSION_BROKER: "false",
      ATLAS_PLATFORM_FEATURE_EVENTS: "false",
    });
    expect(next.platform.forcePlatformId).toBe("darwin");
    expect(next.platform.features.osPermissionBroker).toBe(false);
    expect(next.platform.features.platformEvents).toBe(false);
  });

  it("ignores invalid ATLAS_PLATFORM_FORCE_ID", () => {
    const withForce = mergeAppConfig(DEFAULT_APP_CONFIG, {
      platform: {
        forcePlatformId: "linux",
        features: { osPermissionBroker: true, platformEvents: true },
      },
    });
    const next = applyEnvOverrides(withForce, {
      ATLAS_PLATFORM_FORCE_ID: "solaris",
    });
    expect(next.platform.forcePlatformId).toBe("linux");
  });

  it("accepts ATLAS_PLATFORM feature flags as true", () => {
    const next = applyEnvOverrides(DEFAULT_APP_CONFIG, {
      ATLAS_PLATFORM_FEATURE_OS_PERMISSION_BROKER: "true",
      ATLAS_PLATFORM_FEATURE_EVENTS: "true",
    });
    expect(next.platform.features.osPermissionBroker).toBe(true);
    expect(next.platform.features.platformEvents).toBe(true);
  });
});

describe("loadConfig", () => {
  const repoRoot = resolve(import.meta.dirname, "../../..");

  it("loads production non-secret defaults without reading secrets from JSON", () => {
    const config = loadConfig({
      repoRoot,
      env: "production",
      loadEnvFile: false,
      envVars: { ATLAS_ENV: "production" },
    });

    expect(config.env).toBe("production");
    expect(config.logLevel).toBe("info");
    expect(config.secrets.openaiApiKey).toBeUndefined();
  });

  it("reads secrets only from environment variables", () => {
    const config = loadConfig({
      repoRoot,
      loadEnvFile: false,
      envVars: {
        ATLAS_ENV: "development",
        OPENAI_API_KEY: "sk-test",
      },
    });

    expect(config.secrets.openaiApiKey).toBe("sk-test");
  });
});

describe("mergeAppConfig", () => {
  it("merges nested path overrides", () => {
    const merged = mergeAppConfig(DEFAULT_APP_CONFIG, {
      paths: { dataDir: ".data/custom" },
    });
    expect(merged.paths.dataDir).toBe(".data/custom");
    expect(merged.paths.modelsDir).toBe(DEFAULT_APP_CONFIG.paths.modelsDir);
  });

  it("merges memory.shortTerm overrides", () => {
    const merged = mergeAppConfig(DEFAULT_APP_CONFIG, {
      memory: { shortTerm: { maxEntries: 8, ttlMs: 120000 } },
    });
    expect(merged.memory.shortTerm.maxEntries).toBe(8);
    expect(merged.memory.shortTerm.ttlMs).toBe(120000);
  });

  it("merges memory.classification overrides", () => {
    const merged = mergeAppConfig(DEFAULT_APP_CONFIG, {
      memory: {
        classification: {
          minImportanceToStore: 0.6,
          minConfidenceToStore: 0.5,
          temporaryTtlMs: 1000,
        },
      },
    });
    expect(merged.memory.classification.minImportanceToStore).toBe(0.6);
    expect(merged.memory.classification.minConfidenceToStore).toBe(0.5);
    expect(merged.memory.classification.temporaryTtlMs).toBe(1000);
  });

  it("merges memory.retrieval overrides", () => {
    const merged = mergeAppConfig(DEFAULT_APP_CONFIG, {
      memory: {
        retrieval: {
          limit: 10,
          minScore: 0.25,
          recencyHalfLifeMs: 1000,
        },
      },
    });
    expect(merged.memory.retrieval.limit).toBe(10);
    expect(merged.memory.retrieval.minScore).toBe(0.25);
    expect(merged.memory.retrieval.recencyHalfLifeMs).toBe(1000);
  });

  it("merges memory.consolidation overrides", () => {
    const merged = mergeAppConfig(DEFAULT_APP_CONFIG, {
      memory: {
        consolidation: {
          mergeMinScore: 0.9,
          conflictMinScore: 0.7,
          candidateLimit: 3,
          consolidateOnStore: false,
        },
      },
    });
    expect(merged.memory.consolidation.mergeMinScore).toBe(0.9);
    expect(merged.memory.consolidation.conflictMinScore).toBe(0.7);
    expect(merged.memory.consolidation.candidateLimit).toBe(3);
    expect(merged.memory.consolidation.consolidateOnStore).toBe(false);
  });

  it("includes platform defaults", () => {
    expect(DEFAULT_APP_CONFIG.platform.features.osPermissionBroker).toBe(true);
    expect(DEFAULT_APP_CONFIG.platform.features.platformEvents).toBe(true);
    expect(DEFAULT_APP_CONFIG.platform.forcePlatformId).toBeUndefined();
  });

  it("merges platform feature and force overrides", () => {
    const merged = mergeAppConfig(DEFAULT_APP_CONFIG, {
      platform: {
        forcePlatformId: "win32",
        features: { osPermissionBroker: false },
      },
    });
    expect(merged.platform.forcePlatformId).toBe("win32");
    expect(merged.platform.features.osPermissionBroker).toBe(false);
    expect(merged.platform.features.platformEvents).toBe(true);
  });

  it("loads test.json forcePlatformId", () => {
    const config = loadConfig({
      repoRoot: resolve(import.meta.dirname, "../../.."),
      env: "test",
      loadEnvFile: false,
      envVars: { ATLAS_ENV: "test" },
    });
    expect(config.platform.forcePlatformId).toBe("linux");
  });

  it("loadConfig test platform maps to manager-compatible shape", () => {
    const config = loadConfig({
      repoRoot: resolve(import.meta.dirname, "../../.."),
      env: "test",
      loadEnvFile: false,
      envVars: { ATLAS_ENV: "test" },
    });
    expect(config.platform.forcePlatformId).toBe("linux");
    expect(config.platform.features.osPermissionBroker).toBe(true);
    expect(config.platform.features.platformEvents).toBe(true);
  });
});
