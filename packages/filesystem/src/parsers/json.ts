/**
 * Safe JSON parse for the reading engine (ADR-0078).
 */

export function parseJsonSafe(text: string): {
  data?: unknown;
  parseError?: string;
} {
  try {
    return { data: JSON.parse(text) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { parseError: `JSON parse failed: ${message}` };
  }
}
