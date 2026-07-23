/**
 * Ignore Rules Engine (ADR-0086) — soft skip for discovery (search/list/walk/watch).
 * Security deny list remains separate (paths.ts).
 */
import path from "node:path";

import { normalizePathSeparators } from "./paths.js";

/** Built-in patterns for common junk / dependency / build trees. */
export const BUILTIN_IGNORE_PATTERNS: readonly string[] = [
  "node_modules/",
  "dist/",
  "build/",
  "target/",
  "__pycache__/",
  ".venv/",
  "venv/",
  "*.tmp",
  "*.temp",
  "*~",
  ".DS_Store",
  "Thumbs.db",
];

export interface IgnoreRulesEngineOptions {
  /** Extra config / bootstrap patterns (gitignore syntax subset). */
  patterns?: string[];
  respectGitignore?: boolean;
  respectAtlasignore?: boolean;
  useBuiltinDefaults?: boolean;
  /** Absolute roots that bound gitignore ancestor walks. */
  roots?: string[];
  /**
   * Read ignore-file text. Return undefined when missing.
   * Injected so tests and memory FS work without node:fs.
   */
  readFile?: (absolutePath: string) => string | undefined;
}

export interface ShouldIgnoreOptions {
  isDirectory?: boolean;
}

export interface IgnoreRulesEngine {
  shouldIgnore(absolutePath: string, opts?: ShouldIgnoreOptions): boolean;
  invalidate(pathPrefix?: string): void;
}

interface CompiledRule {
  /** Match relative path (forward slashes, no leading ./). */
  match: (relPath: string, isDirectory: boolean) => boolean;
  negation: boolean;
  directoryOnly: boolean;
}

interface RuleSet {
  /** Directory that owns these rules (absolute). */
  baseDir: string;
  rules: CompiledRule[];
}

function toPosix(p: string): string {
  return normalizePathSeparators(path.resolve(p));
}

function escapeRegex(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globToPathRegExp(
  pattern: string,
  opts: { anchored: boolean },
): RegExp {
  let i = 0;
  let out = "";
  while (i < pattern.length) {
    if (pattern[i] === "*" && pattern[i + 1] === "*") {
      if (pattern[i + 2] === "/") {
        out += "(?:.*/)?";
        i += 3;
        continue;
      }
      out += ".*";
      i += 2;
      continue;
    }
    if (pattern[i] === "*") {
      out += "[^/]*";
      i += 1;
      continue;
    }
    if (pattern[i] === "?") {
      out += "[^/]";
      i += 1;
      continue;
    }
    out += escapeRegex(pattern[i]!);
    i += 1;
  }

  if (opts.anchored) {
    return new RegExp(`^${out}(?:/.*)?$`, "i");
  }
  // Unanchored with slash: match at start or after a /
  if (pattern.includes("/")) {
    return new RegExp(`(?:^|/)${out}(?:/.*)?$`, "i");
  }
  // Basename pattern
  return new RegExp(`^${out}$`, "i");
}

/**
 * Convert a single gitignore-style pattern to a matcher.
 */
export function compileGitignorePattern(
  rawPattern: string,
): CompiledRule | undefined {
  let pattern = rawPattern.trim();
  if (!pattern || pattern.startsWith("#")) {
    return undefined;
  }

  let negation = false;
  if (pattern.startsWith("!")) {
    negation = true;
    pattern = pattern.slice(1);
  }
  if (pattern.startsWith("\\")) {
    pattern = pattern.slice(1);
  }

  let directoryOnly = false;
  if (pattern.endsWith("/")) {
    directoryOnly = true;
    pattern = pattern.slice(0, -1);
  }
  if (!pattern) {
    return undefined;
  }

  const anchored = pattern.startsWith("/");
  if (anchored) {
    pattern = pattern.slice(1);
  }

  const hasSlash = pattern.includes("/");
  const regex = globToPathRegExp(pattern, { anchored });

  return {
    negation,
    directoryOnly,
    match(relPath: string, isDirectory: boolean): boolean {
      const parts = relPath.split("/").filter(Boolean);

      if (directoryOnly) {
        // Match the directory itself or any path under a matching dir segment.
        for (let i = 0; i < parts.length; i += 1) {
          const prefix = parts.slice(0, i + 1).join("/");
          const prefixIsDir = i < parts.length - 1 || isDirectory;
          if (!prefixIsDir) {
            continue;
          }
          if (anchored || hasSlash) {
            if (regex.test(prefix)) {
              return true;
            }
          } else if (parts[i]!.toLowerCase() === pattern.toLowerCase()) {
            return true;
          } else if (regex.test(parts[i]!)) {
            return true;
          }
        }
        return false;
      }

      if (anchored || hasSlash) {
        if (regex.test(relPath)) {
          return true;
        }
        // Descendants of a matched path prefix
        for (let i = 0; i < parts.length; i += 1) {
          const prefix = parts.slice(0, i + 1).join("/");
          if (regex.test(prefix)) {
            return true;
          }
        }
        return false;
      }

      // Basename / glob against final segment or any segment for plain names
      const base = parts[parts.length - 1] ?? relPath;
      if (regex.test(base)) {
        return true;
      }
      // Plain name like "Thumbs.db" anywhere
      if (!pattern.includes("*") && !pattern.includes("?")) {
        return parts.some((p) => p.toLowerCase() === pattern.toLowerCase());
      }
      return parts.some((p) => regex.test(p));
    },
  };
}

export function parseIgnoreFileContent(content: string): CompiledRule[] {
  const rules: CompiledRule[] = [];
  for (const line of content.split(/\r?\n/)) {
    const rule = compileGitignorePattern(line);
    if (rule) {
      rules.push(rule);
    }
  }
  return rules;
}

function relativeToBase(
  absolutePath: string,
  baseDir: string,
): string | undefined {
  const abs = toPosix(absolutePath);
  const base = toPosix(baseDir);
  if (abs === base) {
    return "";
  }
  if (!abs.startsWith(`${base}/`)) {
    return undefined;
  }
  return abs.slice(base.length + 1);
}

function applyRuleSet(
  rules: CompiledRule[],
  relPath: string,
  isDirectory: boolean,
): boolean | undefined {
  let ignored: boolean | undefined;
  for (const rule of rules) {
    if (rule.match(relPath, isDirectory)) {
      ignored = !rule.negation;
    }
  }
  return ignored;
}

function isUnderRoots(absolutePath: string, roots: readonly string[]): boolean {
  if (!roots.length) {
    return true;
  }
  const abs = path.resolve(absolutePath);
  for (const root of roots) {
    const base = path.resolve(root);
    if (abs === base) {
      return true;
    }
    const rel = path.relative(base, abs);
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
      return true;
    }
  }
  return false;
}

function ancestorDirs(
  absolutePath: string,
  roots: readonly string[],
): string[] {
  const dirs: string[] = [];
  let dir = path.dirname(path.resolve(absolutePath));
  const rootSet = roots.map((r) => path.resolve(r));

  for (;;) {
    if (rootSet.length && !isUnderRoots(dir, rootSet)) {
      break;
    }
    dirs.push(dir);

    if (rootSet.length && rootSet.some((r) => r === dir)) {
      break;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return dirs;
}

export function createIgnoreRulesEngine(
  options: IgnoreRulesEngineOptions = {},
): IgnoreRulesEngine {
  const respectGitignore = options.respectGitignore !== false;
  const respectAtlasignore = options.respectAtlasignore !== false;
  const useBuiltinDefaults = options.useBuiltinDefaults !== false;
  const roots = (options.roots ?? []).map((r) => path.resolve(r));
  const readFile =
    options.readFile ??
    ((_absolutePath: string): string | undefined => undefined);

  const globalPatterns = [
    ...(useBuiltinDefaults ? [...BUILTIN_IGNORE_PATTERNS] : []),
    ...(options.patterns ?? []),
  ];
  const globalRules = parseIgnoreFileContent(globalPatterns.join("\n"));

  const cache = new Map<string, RuleSet | null>();

  function loadIgnoreFile(dir: string, fileName: string): RuleSet | null {
    const key = `${toPosix(dir)}::${fileName}`;
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const filePath = path.join(dir, fileName);
    const content = readFile(filePath);
    if (content === undefined) {
      cache.set(key, null);
      return null;
    }
    const set: RuleSet = {
      baseDir: dir,
      rules: parseIgnoreFileContent(content),
    };
    cache.set(key, set);
    return set;
  }

  function shouldIgnore(
    absolutePath: string,
    opts: ShouldIgnoreOptions = {},
  ): boolean {
    const abs = path.resolve(absolutePath);
    if (roots.length && !isUnderRoots(abs, roots)) {
      return false;
    }

    const isDirectory = opts.isDirectory === true;
    const primaryRoot = roots[0] ?? path.dirname(abs);
    const globalRel = relativeToBase(abs, primaryRoot) ?? path.basename(abs);

    let ignored = false;
    const globalDecision = applyRuleSet(globalRules, globalRel, isDirectory);
    if (globalDecision === true) {
      ignored = true;
    } else if (globalDecision === false) {
      ignored = false;
    }

    const dirs = ancestorDirs(abs, roots);
    const sets: RuleSet[] = [];

    if (respectAtlasignore && roots.length) {
      for (const root of roots) {
        const atlas = loadIgnoreFile(root, ".atlasignore");
        if (atlas) {
          sets.push(atlas);
        }
      }
    }

    if (respectGitignore) {
      for (let i = dirs.length - 1; i >= 0; i -= 1) {
        const set = loadIgnoreFile(dirs[i]!, ".gitignore");
        if (set) {
          sets.push(set);
        }
      }
    }

    for (const set of sets) {
      const rel = relativeToBase(abs, set.baseDir);
      if (rel === undefined || rel === "") {
        continue;
      }
      const decision = applyRuleSet(set.rules, rel, isDirectory);
      if (decision === true) {
        ignored = true;
      } else if (decision === false) {
        ignored = false;
      }
    }

    return ignored;
  }

  function invalidate(pathPrefix?: string): void {
    if (!pathPrefix) {
      cache.clear();
      return;
    }
    const prefix = toPosix(pathPrefix);
    for (const key of [...cache.keys()]) {
      if (key.startsWith(prefix) || key.includes(prefix)) {
        cache.delete(key);
      }
    }
  }

  return { shouldIgnore, invalidate };
}
