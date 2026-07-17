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
});
