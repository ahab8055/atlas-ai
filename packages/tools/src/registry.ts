import { validateAgainstSchema } from "./schema.js";
import type {
  RegisteredTool,
  ToolDiscoveryQuery,
  ToolHandler,
  ToolMetadata,
} from "./types.js";
import { compareSemVer, isValidSemVer } from "./version.js";

export interface RegisterToolOptions {
  /** Replace an existing name+version registration. */
  replace?: boolean;
}

/**
 * Central tool registry — registration, discovery, versioning.
 */
export class ToolRegistry {
  /** name → (version → tool) */
  private readonly tools = new Map<string, Map<string, RegisteredTool>>();

  register(
    metadata: ToolMetadata,
    handler: ToolHandler,
    options: RegisterToolOptions = {},
  ): RegisteredTool {
    if (!metadata.name.trim()) {
      throw new Error("Tool name is required");
    }
    if (!isValidSemVer(metadata.version)) {
      throw new Error(
        `Invalid tool version "${metadata.version}" (expected semver x.y.z)`,
      );
    }

    let versions = this.tools.get(metadata.name);
    if (!versions) {
      versions = new Map();
      this.tools.set(metadata.name, versions);
    }

    if (versions.has(metadata.version) && !options.replace) {
      throw new Error(
        `Tool ${metadata.name}@${metadata.version} is already registered`,
      );
    }

    const registered: RegisteredTool = { metadata, handler };
    versions.set(metadata.version, registered);
    return registered;
  }

  /** Self-registration helper used by builtin modules. */
  registerTool(
    tool: RegisteredTool,
    options?: RegisterToolOptions,
  ): RegisteredTool {
    return this.register(tool.metadata, tool.handler, options);
  }

  unregister(name: string, version?: string): boolean {
    const versions = this.tools.get(name);
    if (!versions) {
      return false;
    }
    if (version) {
      const deleted = versions.delete(version);
      if (versions.size === 0) {
        this.tools.delete(name);
      }
      return deleted;
    }
    return this.tools.delete(name);
  }

  has(name: string, version?: string): boolean {
    const versions = this.tools.get(name);
    if (!versions) {
      return false;
    }
    if (!version) {
      return versions.size > 0;
    }
    return versions.has(version);
  }

  /**
   * Resolve a tool by name. Without version, returns the highest semver.
   */
  get(name: string, version?: string): RegisteredTool | undefined {
    const versions = this.tools.get(name);
    if (!versions || versions.size === 0) {
      return undefined;
    }
    if (version) {
      return versions.get(version);
    }
    const latest = [...versions.keys()].sort(compareSemVer).at(-1);
    return latest ? versions.get(latest) : undefined;
  }

  listVersions(name: string): string[] {
    const versions = this.tools.get(name);
    if (!versions) {
      return [];
    }
    return [...versions.keys()].sort(compareSemVer);
  }

  /** Latest version of every registered tool name. */
  list(): RegisteredTool[] {
    const result: RegisteredTool[] = [];
    for (const name of [...this.tools.keys()].sort()) {
      const tool = this.get(name);
      if (tool) {
        result.push(tool);
      }
    }
    return result;
  }

  /** Discover tools matching a query (latest version per name). */
  discover(query: ToolDiscoveryQuery = {}): RegisteredTool[] {
    return this.list().filter((tool) => matchesQuery(tool, query));
  }

  /** Metadata-only listing for agents / UI. */
  listMetadata(): ToolMetadata[] {
    return this.list().map((t) => ({ ...t.metadata }));
  }

  /**
   * Validate input against the tool's input schema, then invoke the handler.
   */
  invoke(
    name: string,
    input: Record<string, unknown>,
    context: Parameters<ToolHandler>[1] = {},
    version?: string,
  ): ReturnType<ToolHandler> {
    const tool = this.get(name, version);
    if (!tool) {
      return {
        ok: false,
        error: version
          ? `Unknown tool: ${name}@${version}`
          : `Unknown tool: ${name}`,
      };
    }

    const validation = validateAgainstSchema(input, tool.metadata.inputSchema);
    if (!validation.valid) {
      return {
        ok: false,
        error: `Invalid input for ${name}: ${validation.errors.join("; ")}`,
      };
    }

    return tool.handler(input, context);
  }
}

function matchesQuery(
  tool: RegisteredTool,
  query: ToolDiscoveryQuery,
): boolean {
  const { metadata } = tool;

  if (query.namePrefix && !metadata.name.startsWith(query.namePrefix)) {
    return false;
  }

  if (query.q) {
    const needle = query.q.toLowerCase();
    const hay = `${metadata.name} ${metadata.description}`.toLowerCase();
    if (!hay.includes(needle)) {
      return false;
    }
  }

  if (query.tags?.length) {
    const tags = new Set(metadata.tags ?? []);
    if (!query.tags.every((t) => tags.has(t))) {
      return false;
    }
  }

  if (query.permissions?.length) {
    const perms = new Set(metadata.permissions);
    if (!query.permissions.every((p) => perms.has(p))) {
      return false;
    }
  }

  return true;
}

let defaultRegistry: ToolRegistry | undefined;

export function getDefaultToolRegistry(): ToolRegistry {
  defaultRegistry ??= new ToolRegistry();
  return defaultRegistry;
}

export function setDefaultToolRegistry(registry: ToolRegistry): void {
  defaultRegistry = registry;
}

/** Register on the process-wide default registry (tools self-register here). */
export function registerTool(
  metadata: ToolMetadata,
  handler: ToolHandler,
  options?: RegisterToolOptions,
): RegisteredTool {
  return getDefaultToolRegistry().register(metadata, handler, options);
}
