/**
 * Minimal YAML subset parser (maps, lists, scalars; depth ≤ 8). ADR-0078.
 * Not a full YAML 1.2 implementation.
 */

const MAX_DEPTH = 8;

export function parseYamlLite(text: string): {
  data?: unknown;
  parseError?: string;
} {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    return { data: null };
  }
  // JSON is a valid YAML subset — try first for common configs.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return { data: JSON.parse(trimmed) as unknown };
    } catch {
      /* fall through to lite parser */
    }
  }
  try {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
    const { value, next } = parseBlock(lines, 0, 0);
    if (next < lines.length) {
      const rest = lines
        .slice(next)
        .some((l) => l.trim() && !l.trim().startsWith("#"));
      if (rest) {
        // Trailing content after a single document is ok if only comments/blank.
      }
    }
    return { data: value };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { parseError: `YAML parse failed: ${message}` };
  }
}

function indentOf(line: string): number {
  const m = /^ */.exec(line);
  return m ? m[0].length : 0;
}

function parseBlock(
  lines: string[],
  start: number,
  minIndent: number,
): { value: unknown; next: number } {
  let i = start;
  while (i < lines.length) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }
    break;
  }
  if (i >= lines.length) {
    return { value: null, next: i };
  }

  const first = lines[i]!;
  const ind = indentOf(first);
  if (ind < minIndent) {
    return { value: null, next: i };
  }
  if (depthFromIndent(ind) > MAX_DEPTH) {
    throw new Error(`nesting exceeds max depth ${MAX_DEPTH}`);
  }

  const t = first.trim();
  if (t.startsWith("- ")) {
    return parseSequence(lines, i, ind);
  }
  if (/^[^:#\s][^:]*:\s*/.test(t) || /^[^:#\s][^:]*:\s*$/.test(t)) {
    return parseMapping(lines, i, ind);
  }
  return { value: parseScalar(t), next: i + 1 };
}

function depthFromIndent(indent: number): number {
  return Math.floor(indent / 2) + 1;
}

function parseSequence(
  lines: string[],
  start: number,
  indent: number,
): { value: unknown[]; next: number } {
  const items: unknown[] = [];
  let i = start;
  while (i < lines.length) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }
    const ind = indentOf(raw);
    if (ind < indent) {
      break;
    }
    if (ind > indent) {
      throw new Error(`unexpected indent in sequence at line ${i + 1}`);
    }
    if (!trimmed.startsWith("- ")) {
      break;
    }
    const rest = trimmed.slice(2);
    if (!rest) {
      const child = parseBlock(lines, i + 1, indent + 1);
      items.push(child.value);
      i = child.next;
      continue;
    }
    if (/^[^:#\s][^:]*:\s*/.test(rest) || rest.endsWith(":")) {
      // Inline map start on same line as list item
      const fake = `${" ".repeat(indent + 2)}${rest}`;
      const spliced = [...lines];
      spliced[i] = fake;
      const child = parseMapping(spliced, i, indent + 2);
      items.push(child.value);
      i = child.next;
      continue;
    }
    items.push(parseScalar(rest));
    i++;
  }
  return { value: items, next: i };
}

function parseMapping(
  lines: string[],
  start: number,
  indent: number,
): { value: Record<string, unknown>; next: number } {
  const obj: Record<string, unknown> = {};
  let i = start;
  while (i < lines.length) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }
    const ind = indentOf(raw);
    if (ind < indent) {
      break;
    }
    if (ind > indent) {
      throw new Error(`unexpected indent in mapping at line ${i + 1}`);
    }
    if (trimmed.startsWith("- ")) {
      break;
    }
    const colon = trimmed.indexOf(":");
    if (colon < 0) {
      throw new Error(`expected key: value at line ${i + 1}`);
    }
    const key = trimmed.slice(0, colon).trim();
    const after = trimmed.slice(colon + 1).trim();
    if (!after) {
      const child = parseBlock(lines, i + 1, indent + 1);
      obj[key] = child.value;
      i = child.next;
      continue;
    }
    obj[key] = parseScalar(after);
    i++;
  }
  return { value: obj, next: i };
}

function parseScalar(raw: string): unknown {
  const s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  if (s === "null" || s === "~") {
    return null;
  }
  if (s === "true") {
    return true;
  }
  if (s === "false") {
    return false;
  }
  if (/^-?\d+$/.test(s)) {
    return Number(s);
  }
  if (/^-?\d+\.\d+$/.test(s)) {
    return Number(s);
  }
  return s;
}
