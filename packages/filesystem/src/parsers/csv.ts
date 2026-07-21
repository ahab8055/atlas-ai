/**
 * Minimal CSV parser (quoted fields, commas). ADR-0078 — no npm deps.
 */

export function parseCsvSafe(text: string): {
  data?: string[][];
  parseError?: string;
} {
  try {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    const input = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < input.length; i++) {
      const ch = input[i]!;
      if (inQuotes) {
        if (ch === '"') {
          if (input[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        continue;
      }
      if (ch === ",") {
        row.push(field);
        field = "";
        continue;
      }
      if (ch === "\n" || (ch === "\r" && input[i + 1] === "\n")) {
        if (ch === "\r") {
          i++;
        }
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        continue;
      }
      if (ch === "\r") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        continue;
      }
      field += ch;
    }
    if (inQuotes) {
      return { parseError: "CSV parse failed: unclosed quote" };
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return { data: rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { parseError: `CSV parse failed: ${message}` };
  }
}
