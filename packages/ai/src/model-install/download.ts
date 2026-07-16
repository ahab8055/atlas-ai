/**
 * Fetch a remote GGUF into a local temp path (Architecture/25 Download step).
 */
import { createWriteStream, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import { AiRuntimeError } from "../errors.js";

export function isHttpUrl(source: string): boolean {
  try {
    const url = new URL(source);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function downloadModelFile(
  url: string,
  options: { fileName?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ path: string; sizeBytes: number }> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new AiRuntimeError("fetch is not available for model download", {
      code: "download_unsupported",
    });
  }

  const response = await fetchImpl(url);
  if (!response.ok || !response.body) {
    throw new AiRuntimeError(
      `Failed to download model (${response.status} ${response.statusText})`,
      { code: "download_failed" },
    );
  }

  const dir = mkdtempSync(path.join(tmpdir(), "atlas-model-dl-"));
  const fromUrl = path.basename(new URL(url).pathname) || "model.gguf";
  const fileName = options.fileName ?? fromUrl;
  const safeName = fileName.toLowerCase().endsWith(".gguf")
    ? fileName
    : `${fileName}.gguf`;
  const dest = path.join(dir, safeName);

  const nodeStream = Readable.fromWeb(
    response.body as import("node:stream/web").ReadableStream,
  );
  await pipeline(nodeStream, createWriteStream(dest));

  const sizeHeader = response.headers.get("content-length");
  const parsed = sizeHeader ? Number.parseInt(sizeHeader, 10) : Number.NaN;
  const sizeBytes = Number.isFinite(parsed) ? parsed : statSync(dest).size;

  return { path: dest, sizeBytes };
}
