/**
 * CLI: atlas knowledge — manage knowledge graph entities and relationships.
 */
import {
  extractEntities,
  type KnowledgeGraphManager,
  type RetrievedEntity,
} from "@atlas-ai/knowledge";

import type { CliRuntime } from "./run.js";

export function tryHandleKnowledgeCommand(
  runtime: CliRuntime,
  rawInput: string,
): boolean {
  const trimmed = rawInput.trim();
  if (!trimmed.toLowerCase().startsWith("knowledge")) {
    return false;
  }

  const tokens = tokenize(trimmed);
  if (tokens[0]?.toLowerCase() !== "knowledge") {
    return false;
  }

  const sub = tokens[1]?.toLowerCase();

  if (sub === "extract") {
    return handleExtract(runtime, tokens.slice(2));
  }

  if (!runtime.database || !runtime.knowledgeGraph) {
    process.stderr.write(
      "Knowledge graph requires the database. Remove --no-db / ATLAS_DB_DISABLED.\n",
    );
    process.exitCode = 1;
    return true;
  }

  const graph = runtime.knowledgeGraph;

  try {
    if (!sub || sub === "help" || sub === "--help" || sub === "-h") {
      process.stdout.write(`${knowledgeUsage()}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "entity") {
      return handleEntity(graph, tokens.slice(2));
    }

    if (sub === "rel" || sub === "relationship") {
      return handleRelationship(graph, tokens.slice(2));
    }

    if (sub === "link") {
      return handleLink(graph, tokens.slice(2));
    }

    if (sub === "neighbors") {
      const id = tokens[2];
      if (!id) {
        throw new Error(
          "Usage: knowledge neighbors <entityId> [--direction out|in|both] [--types uses,related_to]",
        );
      }
      const direction = (readFlag(tokens, "--direction") ?? "both") as
        "out" | "in" | "both";
      const typesRaw = readFlag(tokens, "--types");
      const types = typesRaw
        ? typesRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;
      const hits = graph.getNeighbors(id, { direction, types });
      process.stdout.write(`${formatNeighbors(hits)}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "traverse") {
      const id = tokens[2];
      if (!id) {
        throw new Error(
          "Usage: knowledge traverse <entityId> [--depth N] [--direction out|in|both] [--types uses,depends_on]",
        );
      }
      const depth = Number(readFlag(tokens, "--depth") ?? "2");
      const direction = (readFlag(tokens, "--direction") ?? "both") as
        "out" | "in" | "both";
      const typesRaw = readFlag(tokens, "--types");
      const relationTypes = typesRaw
        ? typesRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;
      const result = graph.traverse({
        startId: id,
        maxDepth: Number.isFinite(depth) ? depth : 2,
        direction,
        relationTypes,
      });
      process.stdout.write(
        `entities (${result.entities.length}):\n` +
          `${formatEntityList(result.entities)}\n` +
          `relationships (${result.relationships.length}):\n` +
          `${formatRelList(result.relationships)}\n`,
      );
      process.exitCode = 0;
      return true;
    }

    if (sub === "export") {
      const startId = readFlag(tokens, "--start");
      const depth = Number(readFlag(tokens, "--depth") ?? "2");
      const snap = graph.exportSnapshot({
        startId: startId || undefined,
        maxDepth: Number.isFinite(depth) ? depth : 2,
      });
      process.stdout.write(`${JSON.stringify(snap, null, 2)}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "retrieve") {
      const query = positionalArgs(tokens, 2).join(" ").trim();
      if (!query) {
        throw new Error('Usage: knowledge retrieve "query"');
      }
      const retrieval = runtime.config.knowledge?.retrieval ?? {
        limit: 8,
        minScore: 0.2,
        maxDepth: 2,
        recencyHalfLifeMs: 2_592_000_000,
      };
      const limit = Number(
        readFlag(tokens, "--limit") ?? String(retrieval.limit),
      );
      const hits = graph.retrieve(query, {
        limit: Number.isFinite(limit) ? limit : retrieval.limit,
        minScore: retrieval.minScore,
        maxDepth: retrieval.maxDepth,
        recencyHalfLifeMs: retrieval.recencyHalfLifeMs,
      });
      process.stdout.write(`${formatRetrievedList(hits)}\n`);
      process.exitCode = 0;
      return true;
    }

    throw new Error(
      `Unknown knowledge subcommand: ${sub}\n${knowledgeUsage()}`,
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
    return true;
  }
}

function handleExtract(runtime: CliRuntime, tokens: string[]): boolean {
  try {
    const store = hasFlag(tokens, "--store");
    const text =
      readFlag(tokens, "--text") ??
      positionalArgs(tokens, 0)
        .filter((t) => t !== "--store")
        .join(" ")
        .trim();
    if (!text) {
      throw new Error('Usage: knowledge extract [--store] "conversation text"');
    }

    const extraction = runtime.config.knowledge?.extraction ?? {
      enabled: true,
      minConfidence: 0.55,
      extractOnRequest: true,
    };
    const relationships = runtime.config.knowledge?.relationships ?? {
      autoLinkOnExtract: true,
      reinforceOnLink: true,
      reinforceStep: 0.05,
    };
    if (!extraction.enabled) {
      process.stderr.write("Knowledge extraction is disabled in config.\n");
      process.exitCode = 1;
      return true;
    }

    const thresholds = { minConfidence: extraction.minConfidence };

    if (store) {
      if (!runtime.knowledgeGraph) {
        process.stderr.write(
          "knowledge extract --store requires the database.\n",
        );
        process.exitCode = 1;
        return true;
      }
      const result = runtime.knowledgeGraph.extractAndStore(text, {
        thresholds,
        autoLinkOnExtract: relationships.autoLinkOnExtract,
        reinforceOnLink: relationships.reinforceOnLink,
        reinforceStep: relationships.reinforceStep,
      });
      process.stdout.write(
        `candidates: ${result.candidates.length}\n` +
          `stored: ${result.stored.length} ` +
          `(new: ${result.stored.filter((s) => s.created).length})\n` +
          `linked: ${result.linked.length}\n` +
          `${formatCandidates(result.candidates)}\n`,
      );
    } else {
      const { candidates } = extractEntities(text, { thresholds });
      process.stdout.write(
        candidates.length === 0
          ? "(no entities)\n"
          : `${formatCandidates(candidates)}\n`,
      );
    }
    process.exitCode = 0;
    return true;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
    return true;
  }
}

function formatCandidates(
  candidates: Array<{
    type: string;
    name: string;
    confidence: number;
    evidence: string;
  }>,
): string {
  return candidates
    .map(
      (c) =>
        `${c.confidence.toFixed(2)}  [${c.type}]  ${c.name}  «${c.evidence}»`,
    )
    .join("\n");
}

function hasFlag(tokens: string[], name: string): boolean {
  return tokens.includes(name);
}

function handleEntity(graph: KnowledgeGraphManager, tokens: string[]): boolean {
  const action = tokens[0]?.toLowerCase();
  if (!action || action === "list") {
    const type = readFlag(tokens, "--type");
    const name = readFlag(tokens, "--name");
    const limit = Number(readFlag(tokens, "--limit") ?? "50");
    const rows = graph.listEntities({
      type,
      name,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    process.stdout.write(`${formatEntityList(rows)}\n`);
    process.exitCode = 0;
    return true;
  }

  if (action === "add") {
    const type = readFlag(tokens, "--type");
    const name =
      readFlag(tokens, "--name") ?? positionalArgs(tokens, 1).join(" ").trim();
    if (!type || !name) {
      throw new Error(
        "Usage: knowledge entity add --type <type> --name <name>",
      );
    }
    const propsRaw = readFlag(tokens, "--properties");
    const properties = propsRaw
      ? (JSON.parse(propsRaw) as Record<string, unknown>)
      : undefined;
    const row = graph.upsertEntity({ type, name, properties });
    process.stdout.write(`Entity ${row.id} (${row.type}: ${row.name})\n`);
    process.exitCode = 0;
    return true;
  }

  if (action === "get") {
    const id = tokens[1];
    if (!id) {
      throw new Error("Usage: knowledge entity get <id>");
    }
    const row = graph.getEntity(id);
    if (!row) {
      throw new Error(`Entity not found: ${id}`);
    }
    process.stdout.write(`${formatEntityDetail(row)}\n`);
    process.exitCode = 0;
    return true;
  }

  if (action === "delete") {
    const id = tokens[1];
    if (!id) {
      throw new Error("Usage: knowledge entity delete <id>");
    }
    const ok = graph.deleteEntity(id);
    process.stdout.write(
      ok ? `Deleted entity ${id}\n` : `Entity not found: ${id}\n`,
    );
    process.exitCode = ok ? 0 : 1;
    return true;
  }

  throw new Error(`Unknown entity action: ${action}`);
}

function handleLink(graph: KnowledgeGraphManager, tokens: string[]): boolean {
  const from = readFlag(tokens, "--from");
  const to = readFlag(tokens, "--to");
  const type = readFlag(tokens, "--type");
  if (!from || !to || !type) {
    throw new Error(
      "Usage: knowledge link --from <id> --to <id> --type <type> [--weight 0.9]",
    );
  }
  const weightRaw = readFlag(tokens, "--weight");
  const weight = weightRaw !== undefined ? Number(weightRaw) : undefined;
  const propsRaw = readFlag(tokens, "--properties");
  const properties = propsRaw
    ? (JSON.parse(propsRaw) as Record<string, unknown>)
    : undefined;
  const result = graph.linkEntities({
    from: { id: from },
    to: { id: to },
    type,
    weight:
      weight !== undefined && Number.isFinite(weight) ? weight : undefined,
    properties,
    source: "manual",
  });
  process.stdout.write(
    `${result.created ? "Linked" : "Reinforced"} ${result.relationship.id} ` +
      `(${result.relationship.type}: ${result.from.name} → ${result.to.name}` +
      `, w=${result.relationship.weight ?? ""})\n`,
  );
  process.exitCode = 0;
  return true;
}

function handleRelationship(
  graph: KnowledgeGraphManager,
  tokens: string[],
): boolean {
  const action = tokens[0]?.toLowerCase();
  if (!action || action === "list") {
    const type = readFlag(tokens, "--type");
    const from = readFlag(tokens, "--from");
    const to = readFlag(tokens, "--to");
    const limit = Number(readFlag(tokens, "--limit") ?? "50");
    const rows = graph.listRelationships({
      type,
      fromEntityId: from,
      toEntityId: to,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    process.stdout.write(`${formatRelList(rows)}\n`);
    process.exitCode = 0;
    return true;
  }

  if (action === "get") {
    const id = tokens[1];
    if (!id) {
      throw new Error("Usage: knowledge rel get <id>");
    }
    const row = graph.getRelationship(id);
    if (!row) {
      throw new Error(`Relationship not found: ${id}`);
    }
    process.stdout.write(`${formatRelDetail(row)}\n`);
    process.exitCode = 0;
    return true;
  }

  if (action === "add") {
    const from = readFlag(tokens, "--from");
    const to = readFlag(tokens, "--to");
    const type = readFlag(tokens, "--type");
    if (!from || !to || !type) {
      throw new Error(
        "Usage: knowledge rel add --from <id> --to <id> --type <type> [--weight 0.9] [--properties JSON]",
      );
    }
    const weightRaw = readFlag(tokens, "--weight");
    const weight = weightRaw !== undefined ? Number(weightRaw) : undefined;
    const propsRaw = readFlag(tokens, "--properties");
    const properties = propsRaw
      ? (JSON.parse(propsRaw) as Record<string, unknown>)
      : undefined;
    const result = graph.linkEntities({
      from: { id: from },
      to: { id: to },
      type,
      weight:
        weight !== undefined && Number.isFinite(weight) ? weight : undefined,
      properties,
      source: "manual",
    });
    process.stdout.write(
      `Relationship ${result.relationship.id} (${result.relationship.type}: ` +
        `${result.relationship.fromEntityId} → ${result.relationship.toEntityId})\n`,
    );
    process.exitCode = 0;
    return true;
  }

  if (action === "update") {
    const id = tokens[1];
    if (!id) {
      throw new Error(
        "Usage: knowledge rel update <id> [--type …] [--weight …] [--properties JSON]",
      );
    }
    const type = readFlag(tokens, "--type");
    const weightRaw = readFlag(tokens, "--weight");
    const propsRaw = readFlag(tokens, "--properties");
    const patch: {
      type?: string;
      weight?: number | null;
      properties?: Record<string, unknown>;
    } = {};
    if (type) {
      patch.type = type;
    }
    if (weightRaw !== undefined) {
      if (weightRaw === "null" || weightRaw === "") {
        patch.weight = null;
      } else {
        const weight = Number(weightRaw);
        if (!Number.isFinite(weight)) {
          throw new Error("Invalid --weight");
        }
        patch.weight = weight;
      }
    }
    if (propsRaw) {
      patch.properties = JSON.parse(propsRaw) as Record<string, unknown>;
    }
    if (
      patch.type === undefined &&
      patch.weight === undefined &&
      patch.properties === undefined
    ) {
      throw new Error("Provide at least one of --type, --weight, --properties");
    }
    const row = graph.updateRelationship(id, patch);
    process.stdout.write(`${formatRelDetail(row)}\n`);
    process.exitCode = 0;
    return true;
  }

  if (action === "delete") {
    const id = tokens[1];
    if (!id) {
      throw new Error("Usage: knowledge rel delete <id>");
    }
    const ok = graph.deleteRelationship(id);
    process.stdout.write(
      ok ? `Deleted relationship ${id}\n` : `Relationship not found: ${id}\n`,
    );
    process.exitCode = ok ? 0 : 1;
    return true;
  }

  throw new Error(`Unknown relationship action: ${action}`);
}

function knowledgeUsage(): string {
  return [
    "atlas knowledge — personal knowledge graph",
    "",
    "  atlas knowledge entity add --type project --name Atlas",
    "  atlas knowledge entity list [--type …] [--name …] [--limit N]",
    "  atlas knowledge entity get <id>",
    "  atlas knowledge entity delete <id>",
    "  atlas knowledge rel add --from <id> --to <id> --type uses [--weight 0.9] [--properties JSON]",
    "  atlas knowledge rel get <id>",
    "  atlas knowledge rel update <id> [--type …] [--weight …] [--properties JSON]",
    "  atlas knowledge rel list [--from …] [--to …] [--type …]",
    "  atlas knowledge rel delete <id>",
    "  atlas knowledge link --from <id> --to <id> --type uses",
    "  atlas knowledge neighbors <entityId> [--direction out|in|both] [--types uses,related_to]",
    "  atlas knowledge traverse <entityId> [--depth 2] [--direction …] [--types …]",
    "  atlas knowledge export [--start <id>] [--depth 2]",
    '  atlas knowledge retrieve "query" [--limit N]',
    '  atlas knowledge extract "I talked to Alice about project Atlas"',
    '  atlas knowledge extract --store "using TypeScript in VS Code"',
  ].join("\n");
}

function formatEntityList(
  rows: Array<{ id: string; type: string; name: string }>,
): string {
  if (rows.length === 0) {
    return "(no entities)";
  }
  return rows.map((r) => `${r.id}  [${r.type}]  ${r.name}`).join("\n");
}

function formatRetrievedList(hits: RetrievedEntity[]): string {
  if (hits.length === 0) {
    return "(no matches)";
  }
  return hits
    .map((h) => {
      const via =
        h.hop > 0 && h.via
          ? ` via ${h.via.type}@hop${h.hop}`
          : h.hop === 0
            ? " (seed)"
            : "";
      return (
        `${h.score.toFixed(3)}  [${h.entity.type}]  ${h.entity.name}` +
        `${via}  ${h.entity.id}`
      );
    })
    .join("\n");
}

function formatEntityDetail(row: {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}): string {
  return [
    `id: ${row.id}`,
    `type: ${row.type}`,
    `name: ${row.name}`,
    `properties: ${JSON.stringify(row.properties)}`,
    `created: ${row.createdAt}`,
    `updated: ${row.updatedAt}`,
  ].join("\n");
}

function formatRelDetail(row: {
  id: string;
  type: string;
  fromEntityId: string;
  toEntityId: string;
  weight?: number;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}): string {
  return [
    `id: ${row.id}`,
    `type: ${row.type}`,
    `from: ${row.fromEntityId}`,
    `to: ${row.toEntityId}`,
    `weight: ${row.weight ?? ""}`,
    `properties: ${JSON.stringify(row.properties)}`,
    `created: ${row.createdAt}`,
    `updated: ${row.updatedAt}`,
  ].join("\n");
}

function formatRelList(
  rows: Array<{
    id: string;
    type: string;
    fromEntityId: string;
    toEntityId: string;
    weight?: number;
  }>,
): string {
  if (rows.length === 0) {
    return "(no relationships)";
  }
  return rows
    .map(
      (r) =>
        `${r.id}  [${r.type}]  ${r.fromEntityId} → ${r.toEntityId}` +
        (r.weight !== undefined ? `  w=${r.weight}` : ""),
    )
    .join("\n");
}

function formatNeighbors(
  hits: Array<{
    entityId: string;
    entity?: { name: string; type: string };
    relationship: { type: string; id: string };
  }>,
): string {
  if (hits.length === 0) {
    return "(no neighbors)";
  }
  return hits
    .map((h) => {
      const label = h.entity
        ? `${h.entity.name} [${h.entity.type}]`
        : h.entityId;
      return `${h.relationship.type} → ${label}  (${h.relationship.id})`;
    })
    .join("\n");
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return tokens;
}

function readFlag(tokens: string[], name: string): string | undefined {
  const idx = tokens.indexOf(name);
  if (idx === -1) {
    return undefined;
  }
  return tokens[idx + 1];
}

function positionalArgs(tokens: string[], start: number): string[] {
  const out: string[] = [];
  for (let i = start; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.startsWith("--")) {
      if (t === "--store") {
        continue;
      }
      i += 1;
      continue;
    }
    out.push(t);
  }
  return out;
}

/** Exported for tests. */
export function __testOnly() {
  return { tokenize, readFlag, knowledgeUsage };
}
