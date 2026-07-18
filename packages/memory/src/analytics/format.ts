/**
 * Format memory stats for CLI diagnostics.
 */
import type { MemoryStatsReport, TimingStats } from "./types.js";

function formatBytes(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTiming(label: string, stats: TimingStats): string {
  if (stats.count === 0) {
    return `${label}: (none this process)`;
  }
  return [
    `${label}: n=${stats.count}`,
    `avg=${Math.round(stats.avgMs)}ms`,
    `min=${Math.round(stats.minMs)}ms`,
    `max=${Math.round(stats.maxMs)}ms`,
  ].join(" ");
}

export function formatMemoryStats(report: MemoryStatsReport): string {
  const { store, process: proc } = report;
  const lines = [
    "Memory stats",
    `Updated: ${report.updatedAt}`,
    "",
    "Store:",
    `  total=${store.total}`,
    `  byType episodic=${store.byType.episodic} semantic=${store.byType.semantic} procedural=${store.byType.procedural}`,
    `  sensitive=${store.sensitive} encrypted=${store.encrypted}`,
    `  contentBytes=${store.contentBytes} (${formatBytes(store.contentBytes)})`,
    `  openConflicts=${report.openConflicts}`,
    "",
    "Retrieval (this process):",
    `  ${formatTiming("timing", proc.retrieval)}`,
    `  slowRetrievals=${proc.slowRetrievals}`,
    "",
    "Duplicates (this process):",
    `  consolidationsRun=${proc.consolidationsRun}`,
    `  merged=${proc.merged} conflictsFlagged=${proc.conflictsFlagged} skipped=${proc.skipped}`,
  ];

  if (proc.lastConsolidation) {
    const last = proc.lastConsolidation;
    lines.push(
      `  lastConsolidation at=${last.at} scanned=${last.scanned} merged=${last.merged} conflicts=${last.conflicts} skipped=${last.skipped}`,
    );
  } else {
    lines.push("  lastConsolidation: (none)");
  }

  if (proc.recentRetrievals.length > 0) {
    lines.push("", "Recent retrievals:");
    for (const sample of proc.recentRetrievals.slice(-5)) {
      lines.push(
        `  - ${sample.at} ${Math.round(sample.tookMs)}ms hits=${sample.hits}` +
          (sample.mode ? ` mode=${sample.mode}` : ""),
      );
    }
  }

  return lines.join("\n");
}
