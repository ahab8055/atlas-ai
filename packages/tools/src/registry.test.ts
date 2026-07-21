import { describe, expect, it } from "vitest";

import {
  compareSemVer,
  getDefaultToolRegistry,
  listToolMetadata,
  listTools,
  registerTool,
  ToolRegistry,
  validateAgainstSchema,
} from "./index.js";

describe("tool registry", () => {
  it("registers builtins with consistent metadata", () => {
    const tools = listTools();
    const names = tools.map((t) => t.metadata.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "system.info",
        "echo",
        "application.open",
        "file.search",
        "file.read",
        "file.write",
        "file.mkdir",
        "file.delete",
        "file.move",
        "file.resolve",
        "file.list",
        "file.walk",
        "file.metadata",
        "code.analyze",
        "project.open",
        "process.start",
      ]),
    );

    for (const tool of tools) {
      expect(tool.metadata).toMatchObject({
        name: expect.any(String),
        description: expect.any(String),
        version: expect.any(String),
        permissions: expect.any(Array),
        risk: expect.any(String),
        inputSchema: expect.any(Object),
        outputSchema: expect.any(Object),
      });
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("supports self-registration and listing", () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        name: "demo.ping",
        description: "Ping demo tool",
        version: "1.0.0",
        permissions: ["system.info"],
        risk: "low",
        tags: ["demo"],
        inputSchema: { type: "object", properties: {} },
        outputSchema: {
          type: "object",
          properties: { pong: { type: "boolean" } },
        },
      },
      () => ({ ok: true, message: "pong", data: { pong: true } }),
    );

    expect(registry.list().map((t) => t.metadata.name)).toEqual(["demo.ping"]);
    expect(registry.discover({ tags: ["demo"] })).toHaveLength(1);
    expect(registry.discover({ q: "ping" })).toHaveLength(1);
    expect(registry.discover({ namePrefix: "demo." })).toHaveLength(1);
  });

  it("supports tool versioning and latest resolution", () => {
    const registry = new ToolRegistry();
    const handler = () => ({ ok: true, message: "v" });

    registry.register(
      {
        name: "demo.versioned",
        description: "v1",
        version: "1.0.0",
        permissions: [],
        risk: "low",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      handler,
    );
    registry.register(
      {
        name: "demo.versioned",
        description: "v2",
        version: "1.1.0",
        permissions: [],
        risk: "low",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      handler,
    );

    expect(compareSemVer("1.0.0", "1.1.0")).toBeLessThan(0);
    expect(registry.listVersions("demo.versioned")).toEqual(["1.0.0", "1.1.0"]);
    expect(registry.get("demo.versioned")?.metadata.version).toBe("1.1.0");
    expect(registry.get("demo.versioned", "1.0.0")?.metadata.description).toBe(
      "v1",
    );
  });

  it("validates input schema before invoke", () => {
    const registry = getDefaultToolRegistry();
    const invalid = registry.invoke("echo", {});
    expect(invalid).toMatchObject({ ok: false });
    if (invalid instanceof Promise) {
      throw new Error("expected sync result");
    }
    expect(invalid.error).toContain("required");

    const valid = registry.invoke("echo", { text: "hi" });
    if (valid instanceof Promise) {
      throw new Error("expected sync result");
    }
    expect(valid.ok).toBe(true);
    expect(valid.message).toBe("hi");
  });

  it("exposes metadata listing for discovery", () => {
    const meta = listToolMetadata();
    expect(meta.length).toBeGreaterThanOrEqual(16);
    expect(meta.every((m) => m.name && m.version && m.inputSchema)).toBe(true);
  });

  it("allows registerTool on the default registry", () => {
    registerTool(
      {
        name: "demo.default-register",
        description: "registered via helper",
        version: "0.1.0",
        permissions: [],
        risk: "low",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      () => ({ ok: true, message: "ok" }),
      { replace: true },
    );

    expect(getDefaultToolRegistry().has("demo.default-register")).toBe(true);
  });

  it("validateAgainstSchema checks object required fields", () => {
    const result = validateAgainstSchema(
      {},
      {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string" } },
      },
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("query");
  });
});
