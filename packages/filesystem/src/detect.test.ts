/**
 * Unit tests for ADR-0089 file type detection.
 */
import { describe, expect, it } from "vitest";

import { detectFileType, sniffSignature } from "./detect.js";
import { isIndexableFormat, processorForFormat } from "./processors.js";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);

describe("sniffSignature", () => {
  it("recognizes PNG/JPEG/PDF/ZIP/GZIP magics", () => {
    expect(sniffSignature(PNG)?.id).toBe("png");
    expect(sniffSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.id).toBe(
      "jpeg",
    );
    expect(sniffSignature(new TextEncoder().encode("%PDF-1.4"))?.id).toBe(
      "pdf",
    );
    expect(sniffSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))?.id).toBe(
      "zip",
    );
    expect(sniffSignature(new Uint8Array([0x1f, 0x8b, 0x08]))?.id).toBe("gzip");
  });
});

describe("detectFileType", () => {
  it("overrides wrong extension with PNG signature", () => {
    const d = detectFileType({ extension: ".txt", bytes: PNG });
    expect(d.format).toBe("binary");
    expect(d.mimeType).toBe("image/png");
    expect(d.signatureId).toBe("png");
    expect(d.extensionMismatch).toBe(true);
    expect(d.source).toBe("signature");
    expect(processorForFormat(d.format)).toBe("reject.binary");
    expect(isIndexableFormat(d.format)).toBe(false);
  });

  it("detects JSON content named as .txt", () => {
    const body = '{"ok":true,"n":1}';
    const d = detectFileType({
      extension: ".txt",
      bytes: new TextEncoder().encode(body),
      sampleText: body,
    });
    expect(d.format).toBe("json");
    expect(d.mimeType).toBe("application/json");
    expect(d.extensionMismatch).toBe(true);
    expect(processorForFormat(d.format)).toBe("read.json");
    expect(isIndexableFormat(d.format)).toBe(true);
  });

  it("keeps matching .png + PNG magic without mismatch", () => {
    const d = detectFileType({ extension: ".png", bytes: PNG });
    expect(d.format).toBe("binary");
    expect(d.mimeType).toBe("image/png");
    expect(d.extensionMismatch).toBe(false);
    expect(d.confidence).toBe("high");
  });

  it("falls back to extension for empty files", () => {
    const d = detectFileType({
      extension: ".md",
      bytes: new Uint8Array(),
    });
    expect(d.format).toBe("markdown");
    expect(d.mimeType).toBe("text/markdown");
    expect(d.source).toBe("extension");
    expect(d.extensionMismatch).toBe(false);
  });

  it("does not upgrade binary extension to text without signature", () => {
    const d = detectFileType({
      extension: ".png",
      sampleText: '{"not":"really png"}',
    });
    expect(d.format).toBe("binary");
    expect(d.mimeType).toBe("image/png");
  });
});
