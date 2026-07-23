import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BUILTIN_IGNORE_PATTERNS,
  compileGitignorePattern,
  createIgnoreRulesEngine,
  parseIgnoreFileContent,
} from "./ignore.js";

const ROOT = "/workspace";

describe("compileGitignorePattern", () => {
  it("matches basename globs and directory-only trailing slash", () => {
    const tmp = compileGitignorePattern("*.tmp")!;
    expect(tmp.match("notes.tmp", false)).toBe(true);
    expect(tmp.match("src/notes.tmp", false)).toBe(true);
    expect(tmp.match("notes.txt", false)).toBe(false);

    const nm = compileGitignorePattern("node_modules/")!;
    expect(nm.match("node_modules", true)).toBe(true);
    expect(nm.match("node_modules/left-pad/index.js", false)).toBe(true);
    expect(nm.match("src/app.ts", false)).toBe(false);
  });

  it("supports negation", () => {
    const rules = parseIgnoreFileContent("*.log\n!important.log\n");
    let ignored: boolean | undefined;
    for (const rule of rules) {
      if (rule.match("important.log", false)) {
        ignored = !rule.negation;
      }
    }
    expect(ignored).toBe(false);

    ignored = undefined;
    for (const rule of rules) {
      if (rule.match("debug.log", false)) {
        ignored = !rule.negation;
      }
    }
    expect(ignored).toBe(true);
  });
});

describe("createIgnoreRulesEngine", () => {
  it("applies builtin defaults for node_modules and temps", () => {
    const engine = createIgnoreRulesEngine({
      roots: [ROOT],
      useBuiltinDefaults: true,
      respectGitignore: false,
      respectAtlasignore: false,
    });

    expect(
      engine.shouldIgnore(`${ROOT}/node_modules`, { isDirectory: true }),
    ).toBe(true);
    expect(engine.shouldIgnore(`${ROOT}/node_modules/pkg/index.js`)).toBe(true);
    expect(engine.shouldIgnore(`${ROOT}/src/app.tmp`)).toBe(true);
    expect(engine.shouldIgnore(`${ROOT}/src/app.ts`)).toBe(false);
    expect(
      BUILTIN_IGNORE_PATTERNS.some((p) => p.includes("node_modules")),
    ).toBe(true);
  });

  it("applies config patterns", () => {
    const engine = createIgnoreRulesEngine({
      roots: [ROOT],
      useBuiltinDefaults: false,
      respectGitignore: false,
      patterns: ["coverage/", "*.bak"],
    });

    expect(engine.shouldIgnore(`${ROOT}/coverage`, { isDirectory: true })).toBe(
      true,
    );
    expect(engine.shouldIgnore(`${ROOT}/a.bak`)).toBe(true);
    expect(engine.shouldIgnore(`${ROOT}/a.ts`)).toBe(false);
  });

  it("respects .gitignore relative to its directory", () => {
    const files = new Map<string, string>([
      [path.join(ROOT, ".gitignore"), "secret.txt\nbuild/\n!build/keep.txt\n"],
      [path.join(ROOT, "pkg", ".gitignore"), "*.generated\n"],
    ]);

    const engine = createIgnoreRulesEngine({
      roots: [ROOT],
      useBuiltinDefaults: false,
      respectGitignore: true,
      respectAtlasignore: false,
      readFile: (p) => files.get(path.resolve(p)),
    });

    expect(engine.shouldIgnore(`${ROOT}/secret.txt`)).toBe(true);
    expect(engine.shouldIgnore(`${ROOT}/build`, { isDirectory: true })).toBe(
      true,
    );
    expect(engine.shouldIgnore(`${ROOT}/build/out.js`)).toBe(true);
    expect(engine.shouldIgnore(`${ROOT}/build/keep.txt`)).toBe(false);
    expect(engine.shouldIgnore(`${ROOT}/pkg/foo.generated`)).toBe(true);
    expect(engine.shouldIgnore(`${ROOT}/pkg/foo.ts`)).toBe(false);
  });

  it("respects .atlasignore at root", () => {
    const files = new Map<string, string>([
      [path.join(ROOT, ".atlasignore"), "local-only/\n"],
    ]);

    const engine = createIgnoreRulesEngine({
      roots: [ROOT],
      useBuiltinDefaults: false,
      respectGitignore: false,
      respectAtlasignore: true,
      readFile: (p) => files.get(path.resolve(p)),
    });

    expect(
      engine.shouldIgnore(`${ROOT}/local-only`, { isDirectory: true }),
    ).toBe(true);
    expect(engine.shouldIgnore(`${ROOT}/src/a.ts`)).toBe(false);
  });

  it("invalidate clears cached ignore files", () => {
    const files = new Map<string, string>([
      [path.join(ROOT, ".gitignore"), "old.txt\n"],
    ]);
    const engine = createIgnoreRulesEngine({
      roots: [ROOT],
      useBuiltinDefaults: false,
      readFile: (p) => files.get(path.resolve(p)),
    });

    expect(engine.shouldIgnore(`${ROOT}/old.txt`)).toBe(true);
    files.set(path.join(ROOT, ".gitignore"), "new.txt\n");
    // cached — still old
    expect(engine.shouldIgnore(`${ROOT}/old.txt`)).toBe(true);
    engine.invalidate(ROOT);
    expect(engine.shouldIgnore(`${ROOT}/old.txt`)).toBe(false);
    expect(engine.shouldIgnore(`${ROOT}/new.txt`)).toBe(true);
  });
});
