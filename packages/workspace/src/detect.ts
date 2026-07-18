/**
 * Detect project root by walking parents for .git or strong markers.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import type { DetectResult } from "./types.js";

const MARKERS = [
  "package.json",
  "Cargo.toml",
  "pyproject.toml",
  "go.mod",
  "pom.xml",
  "composer.json",
] as const;

export interface DetectProjectRootOptions {
  /** Max parent hops (default 32). */
  maxDepth?: number;
}

/**
 * Walk from `startPath` upward until `.git` or a project marker is found.
 */
export function detectProjectRoot(
  startPath: string = process.cwd(),
  options: DetectProjectRootOptions = {},
): DetectResult | undefined {
  const maxDepth = Math.max(1, options.maxDepth ?? 32);
  let current = resolve(startPath);
  try {
    if (statSync(current).isFile()) {
      current = dirname(current);
    }
  } catch {
    return undefined;
  }

  for (let i = 0; i < maxDepth; i += 1) {
    const gitDir = join(current, ".git");
    if (existsSync(gitDir)) {
      const gitMeta = readGitMetadata(current);
      return {
        rootPath: current,
        name: basename(current),
        kind: "git",
        repoUrl: gitMeta.repoUrl,
        defaultBranch: gitMeta.defaultBranch,
      };
    }

    for (const marker of MARKERS) {
      if (existsSync(join(current, marker))) {
        return {
          rootPath: current,
          name: basename(current),
          kind: "marker",
          marker,
        };
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return undefined;
}

function readGitMetadata(root: string): {
  repoUrl?: string;
  defaultBranch?: string;
} {
  const result: { repoUrl?: string; defaultBranch?: string } = {};
  try {
    const config = readFileSync(join(root, ".git", "config"), "utf8");
    const origin = config.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/);
    if (origin?.[1]) {
      result.repoUrl = origin[1].trim();
    }
  } catch {
    // ignore
  }

  try {
    const head = readFileSync(join(root, ".git", "HEAD"), "utf8").trim();
    const ref = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    if (ref?.[1]) {
      result.defaultBranch = ref[1].trim();
    }
  } catch {
    // ignore
  }

  return result;
}
