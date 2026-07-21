/**
 * BOM detection and text encode/decode (ADR-0078 / ADR-0079).
 * No external charset libs.
 */

export type WriteEncoding = "utf-8" | "utf-16le" | "utf-16be";

export interface DecodeResult {
  text: string;
  encoding: string;
  /** True when bytes look binary (high NUL / replacement ratio). */
  binaryLike: boolean;
}

export interface EncodeOptions {
  encoding?: WriteEncoding;
  /** UTF-8 BOM (default false). UTF-16 always includes BOM. */
  bom?: boolean;
}

function looksBinary(bytes: Uint8Array, text: string): boolean {
  if (bytes.length === 0) {
    return false;
  }
  let nul = 0;
  const sample = Math.min(bytes.length, 4096);
  for (let i = 0; i < sample; i++) {
    if (bytes[i] === 0) {
      nul++;
    }
  }
  if (nul / sample > 0.02) {
    return true;
  }
  const replacements = (text.match(/\uFFFD/g) ?? []).length;
  if (text.length > 0 && replacements / text.length > 0.1) {
    return true;
  }
  return false;
}

export function decodeBytes(bytes: Uint8Array): DecodeResult {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    const text = new TextDecoder("utf-8").decode(bytes.subarray(3));
    return {
      text,
      encoding: "utf-8",
      binaryLike: looksBinary(bytes.subarray(3), text),
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    const text = new TextDecoder("utf-16le").decode(bytes.subarray(2));
    return {
      text,
      encoding: "utf-16le",
      binaryLike: looksBinary(bytes.subarray(2), text),
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const text = new TextDecoder("utf-16be").decode(bytes.subarray(2));
    return {
      text,
      encoding: "utf-16be",
      binaryLike: looksBinary(bytes.subarray(2), text),
    };
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return {
    text,
    encoding: "utf-8",
    binaryLike: looksBinary(bytes, text),
  };
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Encode text to bytes for writing (ADR-0079). */
export function encodeBytes(
  text: string,
  opts: EncodeOptions = {},
): Uint8Array {
  const encoding = opts.encoding ?? "utf-8";
  if (encoding === "utf-8") {
    const body = new TextEncoder().encode(text);
    if (opts.bom) {
      return concat(new Uint8Array([0xef, 0xbb, 0xbf]), body);
    }
    return body;
  }
  if (encoding === "utf-16le") {
    const buf = Buffer.from(text, "utf16le");
    return concat(new Uint8Array([0xff, 0xfe]), new Uint8Array(buf));
  }
  // utf-16be
  const le = Buffer.from(text, "utf16le");
  const be = Buffer.allocUnsafe(le.length);
  for (let i = 0; i < le.length; i += 2) {
    be[i] = le[i + 1]!;
    be[i + 1] = le[i]!;
  }
  return concat(new Uint8Array([0xfe, 0xff]), new Uint8Array(be));
}
