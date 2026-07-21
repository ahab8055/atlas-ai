/**
 * BOM detection and text decode (ADR-0078). No external charset libs.
 */

export interface DecodeResult {
  text: string;
  encoding: string;
  /** True when bytes look binary (high NUL / replacement ratio). */
  binaryLike: boolean;
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
