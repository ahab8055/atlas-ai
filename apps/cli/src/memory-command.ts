/**
 * CLI: atlas memory — manage long-term memories + classify candidates.
 */
import type { LongTermMemoryType } from "@atlas-ai/database";
import {
  classifyMemory,
  decryptBackup,
  encryptBackup,
  formatMemoryStats,
  isBackupEnvelope,
  parseBackupJson,
  type MemoryClassificationResult,
  type MemoryRecord,
  type MemorySearchMode,
  type RetrievedMemory,
} from "@atlas-ai/memory";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { CliRuntime } from "./run.js";

const LONG_TERM_TYPES = new Set(["episodic", "semantic", "procedural"]);

export function tryHandleMemoryCommand(
  runtime: CliRuntime,
  rawInput: string,
): boolean {
  const trimmed = rawInput.trim();
  if (!trimmed.toLowerCase().startsWith("memory")) {
    return false;
  }

  const tokens = tokenize(trimmed);
  if (tokens[0]?.toLowerCase() !== "memory") {
    return false;
  }

  const sub = tokens[1]?.toLowerCase();

  // classify works without a database
  if (sub === "classify") {
    try {
      const text = positionalArgs(tokens, 2).join(" ").trim();
      if (!text) {
        throw new Error('Usage: memory classify "text"');
      }
      const thresholds = runtime.config.memory.classification;
      const result = classifyMemory({ text }, { thresholds });
      process.stdout.write(`${formatClassification(result)}\n`);
      process.exitCode = 0;
    } catch (error) {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 2;
    }
    return true;
  }

  if (!runtime.database || !runtime.longTermMemory) {
    process.stderr.write(
      "Long-term memory requires the database. Remove --no-db / ATLAS_DB_DISABLED.\n",
    );
    process.exitCode = 1;
    return true;
  }

  const ltm = runtime.longTermMemory;

  try {
    if (!sub || sub === "help" || sub === "--help" || sub === "-h") {
      process.stdout.write(`${memoryUsage()}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "list") {
      const type = readFlag(tokens, "--type") as LongTermMemoryType | undefined;
      if (type && !LONG_TERM_TYPES.has(type)) {
        throw new Error(`Invalid --type (use episodic|semantic|procedural)`);
      }
      const limit = Number(readFlag(tokens, "--limit") ?? "50");
      const rows = ltm.list({
        type,
        limit: Number.isFinite(limit) ? limit : 50,
      });
      process.stdout.write(`${formatMemoryList(rows)}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "add") {
      const useClassify = hasFlag(tokens, "--classify");
      const content = positionalArgs(tokens, 2)
        .filter((t) => !t.startsWith("--"))
        .join(" ")
        .trim();
      const contentFromFlag = readFlag(tokens, "--content");
      const finalContent = (contentFromFlag ?? content).trim();
      if (!finalContent) {
        throw new Error(
          useClassify
            ? 'Usage: memory add --classify "content"'
            : 'Usage: memory add --type <type> "content"',
        );
      }

      const activeProjectId = runtime.workspace?.getActive()?.id;

      if (useClassify) {
        const thresholds = runtime.config.memory.classification;
        const consolidation = runtime.config.memory.consolidation;
        const sensitive = hasFlag(tokens, "--sensitive");
        const result = ltm.evaluateAndStore(finalContent, {
          thresholds,
          consolidation,
          consolidateOnStore: consolidation.consolidateOnStore,
          projectId: activeProjectId,
          sensitivity: sensitive ? "sensitive" : undefined,
        });
        if (result.stored && result.record) {
          const via =
            result.consolidation?.action &&
            result.consolidation.action !== "insert"
              ? ` (${result.consolidation.action})`
              : "";
          process.stdout.write(
            `Stored ${result.record.type} memory ${result.record.id}${via}\n` +
              `${formatClassification(result.classification)}\n`,
          );
        } else {
          process.stdout.write(
            `Not stored (action=${result.classification.action})\n` +
              `${formatClassification(result.classification)}\n`,
          );
        }
        process.exitCode = 0;
        return true;
      }

      const type = (readFlag(tokens, "--type") ??
        "semantic") as LongTermMemoryType;
      if (!LONG_TERM_TYPES.has(type)) {
        throw new Error(`Invalid --type (use episodic|semantic|procedural)`);
      }
      const importanceRaw = readFlag(tokens, "--importance");
      const importance =
        importanceRaw !== undefined ? Number(importanceRaw) : undefined;
      const sensitive = hasFlag(tokens, "--sensitive");
      const stored = ltm.store({
        type,
        content: finalContent,
        importance: Number.isFinite(importance) ? importance : undefined,
        projectId: activeProjectId,
        sensitivity: sensitive ? "sensitive" : "normal",
      });
      process.stdout.write(
        `Stored ${stored.type} memory ${stored.id}` +
          (sensitive ? " (encrypted)" : "") +
          `\n`,
      );
      process.exitCode = 0;
      return true;
    }

    if (sub === "get") {
      const id = tokens[2];
      if (!id) {
        throw new Error("Usage: memory get <id>");
      }
      const row = ltm.get(id);
      if (!row) {
        process.stderr.write(`Memory not found: ${id}\n`);
        process.exitCode = 1;
        return true;
      }
      process.stdout.write(`${formatMemoryDetail(row)}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "update") {
      const id = tokens[2];
      if (!id) {
        throw new Error('Usage: memory update <id> --content "..."');
      }
      const content = readFlag(tokens, "--content");
      const importanceRaw = readFlag(tokens, "--importance");
      if (content === undefined && importanceRaw === undefined) {
        throw new Error("Provide --content and/or --importance");
      }
      const updated = ltm.update(id, {
        content,
        importance:
          importanceRaw !== undefined ? Number(importanceRaw) : undefined,
      });
      process.stdout.write(`Updated memory ${updated.id}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "delete") {
      const id = tokens[2];
      if (!id || id.startsWith("--")) {
        throw new Error("Usage: memory delete <id> --confirm");
      }
      ensureDeleteAllowed(runtime, tokens);
      const ok = ltm.secureDelete(id);
      if (!ok) {
        process.stderr.write(`Memory not found: ${id}\n`);
        process.exitCode = 1;
        return true;
      }
      process.stdout.write(`Securely deleted memory ${id}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "clear") {
      ensureDeleteAllowed(runtime, tokens);
      const type = readFlag(tokens, "--type") as LongTermMemoryType | undefined;
      if (type && !LONG_TERM_TYPES.has(type)) {
        throw new Error(`Invalid --type (use episodic|semantic|procedural)`);
      }
      const deleted = ltm.clear({ type });
      process.stdout.write(
        `Securely cleared ${deleted} memor${deleted === 1 ? "y" : "ies"}\n`,
      );
      process.exitCode = 0;
      return true;
    }

    if (sub === "search") {
      const query = positionalArgs(tokens, 2).join(" ").trim();
      if (!query) {
        throw new Error('Usage: memory search "query"');
      }
      const type = readFlag(tokens, "--type") as LongTermMemoryType | undefined;
      if (type && !LONG_TERM_TYPES.has(type)) {
        throw new Error(`Invalid --type (use episodic|semantic|procedural)`);
      }
      const mode = parseSearchMode(readFlag(tokens, "--mode"));
      const tags = parseTags(readFlag(tokens, "--tags"));
      const sessionId = readFlag(tokens, "--session");
      const limit = Number(readFlag(tokens, "--limit") ?? "5");
      const activeProjectId = runtime.workspace?.getActive()?.id;
      const hits = ltm.search(query, {
        type,
        mode,
        tags,
        sessionId,
        limit: Number.isFinite(limit) ? limit : 5,
        projectId: activeProjectId,
      });
      process.stdout.write(`${formatMemoryList(hits)}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "retrieve") {
      const query = positionalArgs(tokens, 2).join(" ").trim();
      if (!query) {
        throw new Error('Usage: memory retrieve "query"');
      }
      const type = readFlag(tokens, "--type") as LongTermMemoryType | undefined;
      if (type && !LONG_TERM_TYPES.has(type)) {
        throw new Error(`Invalid --type (use episodic|semantic|procedural)`);
      }
      const mode = parseSearchMode(readFlag(tokens, "--mode"));
      const tags = parseTags(readFlag(tokens, "--tags"));
      const sessionId = readFlag(tokens, "--session");
      const limit = Number(
        readFlag(tokens, "--limit") ??
          String(runtime.config.memory.retrieval.limit),
      );
      const activeProjectId = runtime.workspace?.getActive()?.id;
      const result = ltm.searchMemories({
        query,
        type,
        mode: mode ?? "hybrid",
        tags,
        sessionId,
        limit: Number.isFinite(limit)
          ? limit
          : runtime.config.memory.retrieval.limit,
        minScore: runtime.config.memory.retrieval.minScore,
        recencyHalfLifeMs: runtime.config.memory.retrieval.recencyHalfLifeMs,
        projectId: activeProjectId,
      });
      const hits: RetrievedMemory[] = result.hits.map((h) => ({
        record: h.record,
        score: h.score,
        breakdown: h.breakdown!,
      }));
      process.stdout.write(`${formatRetrievedList(hits)}\n`);
      process.stdout.write(`tookMs=${Math.round(result.tookMs)}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "stats") {
      const report = ltm.getStats();
      process.stdout.write(`${formatMemoryStats(report)}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "purge-expired") {
      ensureDeleteAllowed(runtime, tokens);
      const result = ltm.purgeExpired();
      process.stdout.write(
        `Purged ${result.deleted} expired memor${result.deleted === 1 ? "y" : "ies"}` +
          ` (scanned ${result.scanned})\n`,
      );
      process.exitCode = 0;
      return true;
    }

    if (sub === "consolidate") {
      const dryRun = hasFlag(tokens, "--dry-run");
      const type = readFlag(tokens, "--type") as LongTermMemoryType | undefined;
      if (type && !LONG_TERM_TYPES.has(type)) {
        throw new Error(`Invalid --type (use episodic|semantic|procedural)`);
      }
      const limit = Number(readFlag(tokens, "--limit") ?? "100");
      const cfg = runtime.config.memory.consolidation;
      const result = ltm.consolidate({
        type,
        dryRun,
        limit: Number.isFinite(limit) ? limit : 100,
        thresholds: cfg,
      });
      process.stdout.write(
        `${dryRun ? "[dry-run] " : ""}` +
          `scanned=${result.scanned} merged=${result.merged} ` +
          `conflicts=${result.conflicts} skipped=${result.skipped}\n`,
      );
      for (const pair of result.pairs) {
        if (pair.decision.action === "skip") {
          continue;
        }
        process.stdout.write(
          `  ${pair.decision.action} score=${pair.decision.score.toFixed(3)} ` +
            `${pair.decision.survivorId} <- ${pair.decision.otherId}` +
            ` (${pair.decision.reason})\n`,
        );
      }
      process.exitCode = 0;
      return true;
    }

    if (sub === "conflicts") {
      const rows = ltm.listConflicts({ limit: 100 });
      if (rows.length === 0) {
        process.stdout.write("(no open conflicts)\n");
      } else {
        process.stdout.write(
          rows
            .map((r) => {
              const c = r.metadata?.conflict as
                { withId?: string; note?: string } | undefined;
              return (
                `${r.id}  [${r.type}]  vs ${c?.withId ?? "?"}  ` +
                `${truncate(r.content, 60)}` +
                (c?.note ? `  (${c.note})` : "")
              );
            })
            .join("\n") + "\n",
        );
      }
      process.exitCode = 0;
      return true;
    }

    if (sub === "export") {
      const type = readFlag(tokens, "--type") as LongTermMemoryType | undefined;
      if (type && !LONG_TERM_TYPES.has(type)) {
        throw new Error(`Invalid --type (use episodic|semantic|procedural)`);
      }
      const outPath = readFlag(tokens, "--out");
      const encrypt = hasFlag(tokens, "--encrypt");
      const snapshot = ltm.exportBackup({ type });
      if (encrypt) {
        const passphrase = readBackupPassphrase(tokens);
        const envelope = encryptBackup(snapshot, passphrase);
        const body = `${JSON.stringify(envelope, null, 2)}\n`;
        if (outPath) {
          writeBackupFile(outPath, body);
          process.stdout.write(
            `Exported ${snapshot.count} encrypted memor${snapshot.count === 1 ? "y" : "ies"} to ${outPath}\n`,
          );
        } else {
          process.stdout.write(body);
        }
      } else {
        const body = `${JSON.stringify(snapshot, null, 2)}\n`;
        if (outPath) {
          writeBackupFile(outPath, body);
          process.stdout.write(
            `Exported ${snapshot.count} memor${snapshot.count === 1 ? "y" : "ies"} to ${outPath}\n`,
          );
        } else {
          process.stdout.write(body);
        }
      }
      process.exitCode = 0;
      return true;
    }

    if (sub === "import") {
      const pathArg = tokens[2];
      if (!pathArg || pathArg.startsWith("--")) {
        throw new Error(
          "Usage: memory import <path> [--validate-only] [--replace --confirm] [--encrypt]",
        );
      }
      const raw = readFileSync(pathArg, "utf8");
      const parsed = parseBackupJson(raw);
      let snapshot;
      if (isBackupEnvelope(parsed) || hasFlag(tokens, "--encrypt")) {
        const passphrase = readBackupPassphrase(tokens);
        if (!isBackupEnvelope(parsed)) {
          throw new Error("File is not an encrypted memory backup envelope");
        }
        snapshot = decryptBackup(parsed, passphrase);
      } else {
        snapshot = parsed;
      }
      const validated = ltm.validateBackup(snapshot);
      if (!validated.ok || !validated.snapshot) {
        process.stderr.write(
          `Backup validation failed:\n${validated.errors.map((e) => `  - ${e}`).join("\n")}\n`,
        );
        process.exitCode = 2;
        return true;
      }
      if (hasFlag(tokens, "--validate-only")) {
        process.stdout.write(
          `Backup OK: ${validated.snapshot.count} memor${validated.snapshot.count === 1 ? "y" : "ies"}` +
            ` (checksum ${validated.snapshot.checksum.slice(0, 12)}…)\n`,
        );
        process.exitCode = 0;
        return true;
      }
      const replace = hasFlag(tokens, "--replace");
      if (replace) {
        ensureDeleteAllowed(runtime, tokens);
      }
      const result = ltm.importBackup(validated.snapshot, {
        mode: replace ? "replace" : "merge",
      });
      process.stdout.write(
        `Imported ${result.imported}, skipped ${result.skipped}` +
          (replace ? " (replace)" : " (merge)") +
          `\n`,
      );
      if (result.errors.length > 0) {
        process.stderr.write(
          result.errors.map((e) => `  - ${e}`).join("\n") + "\n",
        );
        process.exitCode = 2;
        return true;
      }
      process.exitCode = 0;
      return true;
    }

    throw new Error(`Unknown memory subcommand: ${sub}\n${memoryUsage()}`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
    return true;
  }
}

function memoryUsage(): string {
  return [
    "atlas memory — long-term memory + classification",
    "",
    '  atlas memory classify "text"',
    "  atlas memory list [--type episodic|semantic|procedural] [--limit N]",
    '  atlas memory add --type semantic "content" [--importance 0.9] [--sensitive]',
    '  atlas memory add --classify "content" [--sensitive]',
    "  atlas memory get <id>",
    '  atlas memory update <id> --content "..." [--importance 0.8]',
    "  atlas memory delete <id> --confirm",
    "  atlas memory clear --confirm [--type …]",
    '  atlas memory search "query" [--mode keyword|semantic|hybrid]',
    "    [--type …] [--tags a,b] [--session id] [--limit N]",
    '  atlas memory retrieve "query" [--mode …] [--type …]',
    "    [--tags a,b] [--session id] [--limit N]",
    "  atlas memory stats",
    "  atlas memory consolidate [--dry-run] [--type …] [--limit N]",
    "  atlas memory conflicts",
    "  atlas memory purge-expired --confirm",
    "  atlas memory export [--out path] [--type …] [--encrypt]",
    "  atlas memory import <path> [--validate-only] [--replace --confirm] [--encrypt]",
  ].join("\n");
}

function readBackupPassphrase(tokens: string[]): string {
  const envName =
    readFlag(tokens, "--passphrase-env") ?? "ATLAS_BACKUP_PASSPHRASE";
  const value = process.env[envName];
  if (!value) {
    throw new Error(
      `Encrypted backup requires passphrase in env ${envName} (or --passphrase-env NAME)`,
    );
  }
  return value;
}

function writeBackupFile(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, { mode: 0o600 });
}

function ensureDeleteAllowed(runtime: CliRuntime, tokens: string[]): void {
  if (!hasFlag(tokens, "--confirm") && !hasFlag(tokens, "--yes")) {
    throw new Error(
      "Destructive memory ops require --confirm (grants memory.delete for this session)",
    );
  }
  runtime.permissions.grant("memory.delete");
}

function formatClassification(result: MemoryClassificationResult): string {
  return [
    `action: ${result.action}`,
    `type: ${result.suggestedType}`,
    `durability: ${result.durability}`,
    `importance: ${result.importance.toFixed(2)}`,
    `confidence: ${result.confidence.toFixed(2)}`,
    `reasons: ${result.reasons.join("; ")}`,
    result.expiresAt ? `expiresAt: ${result.expiresAt}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatMemoryList(rows: MemoryRecord[]): string {
  if (rows.length === 0) {
    return "(no memories)";
  }
  return rows
    .map(
      (r) =>
        `${r.id}  [${r.type}]  ${truncate(r.content, 80)}` +
        (r.importance !== undefined ? `  imp=${r.importance}` : ""),
    )
    .join("\n");
}

function formatRetrievedList(hits: RetrievedMemory[]): string {
  if (hits.length === 0) {
    return "(no matches)";
  }
  return hits
    .map(
      (h) =>
        `${h.score.toFixed(3)}  ${h.record.id}  [${h.record.type}]  ` +
        `${truncate(h.record.content, 70)}`,
    )
    .join("\n");
}

function formatMemoryDetail(row: MemoryRecord): string {
  return [
    `id: ${row.id}`,
    `type: ${row.type}`,
    `scope: ${row.scope}`,
    `content: ${row.content}`,
    `sensitivity: ${row.sensitivity ?? "normal"}`,
    `encrypted: ${row.encrypted ? "yes" : "no"}`,
    `importance: ${row.importance ?? ""}`,
    `confidence: ${row.confidence ?? ""}`,
    `tags: ${(row.tags ?? []).join(", ")}`,
    `created: ${row.createdAt}`,
    `updated: ${row.updatedAt}`,
  ].join("\n");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
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

const SEARCH_MODES = new Set<MemorySearchMode>([
  "keyword",
  "semantic",
  "hybrid",
]);

function parseSearchMode(
  raw: string | undefined,
): MemorySearchMode | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!SEARCH_MODES.has(raw as MemorySearchMode)) {
    throw new Error(`Invalid --mode (use keyword|semantic|hybrid)`);
  }
  return raw as MemorySearchMode;
}

function parseTags(raw: string | undefined): string[] | undefined {
  if (raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const tags = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function hasFlag(tokens: string[], name: string): boolean {
  return tokens.includes(name);
}

function positionalArgs(tokens: string[], start: number): string[] {
  const out: string[] = [];
  for (let i = start; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.startsWith("--")) {
      // boolean flags without values (e.g. --classify)
      if (
        t === "--classify" ||
        t === "--dry-run" ||
        t === "--sensitive" ||
        t === "--confirm" ||
        t === "--yes" ||
        t === "--encrypt" ||
        t === "--validate-only" ||
        t === "--replace"
      ) {
        continue;
      }
      i += 1; // skip flag value
      continue;
    }
    out.push(t);
  }
  return out;
}

/** Exported for tests. */
export function __testOnly() {
  return { tokenize, readFlag, formatMemoryList, memoryUsage, hasFlag };
}
