/**
 * Entity name normalization for duplicate detection.
 */

/** Trim, collapse whitespace, NFC normalize. */
export function normalizeEntityName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** Case-insensitive dedupe key: type + NUL + lower(name). */
export function entityDedupeKey(type: string, name: string): string {
  return `${type.trim()}\0${normalizeEntityName(name).toLowerCase()}`;
}
