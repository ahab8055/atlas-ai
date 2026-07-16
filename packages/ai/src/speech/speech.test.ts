import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GGUF_MAGIC } from "../gguf.js";
import { createModelRegistry } from "../model-registry/registry.js";
import {
  MockSpeechToTextProvider,
  MockTextToSpeechProvider,
  createSpeechModelManager,
  ensureSpeechStructure,
  listSpeechFiles,
  scanSpeechModels,
  speechDestinationPath,
} from "./index.js";

function writeToyGguf(filePath: string): void {
  writeFileSync(
    filePath,
    Buffer.concat([Buffer.from(GGUF_MAGIC), Buffer.alloc(64, 0)]),
  );
}

describe("speech storage", () => {
  it("ensures speech/stt and speech/tts layout", () => {
    const root = join(tmpdir(), `atlas-speech-${Date.now()}`);
    mkdirSync(root, { recursive: true });
    try {
      const result = ensureSpeechStructure(root);
      expect(result.speechDir).toBe(join(root, "speech"));
      expect(listSpeechFiles(root)).toEqual([]);
      expect(speechDestinationPath(root, "tts", "voice.onnx")).toBe(
        join(root, "speech", "tts", "voice.onnx"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lists GGUF and non-GGUF speech files with modality", () => {
    const root = join(tmpdir(), `atlas-speech-files-${Date.now()}`);
    mkdirSync(join(root, "speech", "stt"), { recursive: true });
    mkdirSync(join(root, "speech", "tts"), { recursive: true });
    writeToyGguf(join(root, "speech", "stt", "whisper-en.gguf"));
    writeFileSync(
      join(root, "speech", "tts", "piper-en.onnx"),
      Buffer.alloc(32, 1),
    );

    try {
      const files = listSpeechFiles(root);
      expect(files.map((f) => f.id).sort()).toEqual([
        "speech/stt/whisper-en",
        "speech/tts/piper-en",
      ]);
      const stt = files.find((f) => f.modality === "stt");
      const tts = files.find((f) => f.modality === "tts");
      expect(stt?.format).toBe("gguf");
      expect(stt?.valid).toBe(true);
      expect(tts?.format).toBe("onnx");
      expect(tts?.valid).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("speech discover", () => {
  it("maps files to registry inputs with speech + stt/tts capabilities", () => {
    const root = join(tmpdir(), `atlas-speech-scan-${Date.now()}`);
    mkdirSync(join(root, "speech", "stt"), { recursive: true });
    mkdirSync(join(root, "speech", "tts"), { recursive: true });
    writeToyGguf(join(root, "speech", "stt", "whisper.gguf"));
    writeFileSync(
      join(root, "speech", "tts", "voice.bin"),
      Buffer.alloc(16, 2),
    );

    try {
      const scanned = scanSpeechModels({ modelsDir: root });
      expect(scanned).toHaveLength(2);
      const stt = scanned.find((m) => m.requirements?.speechModality === "stt");
      const tts = scanned.find((m) => m.requirements?.speechModality === "tts");
      expect(stt?.capabilities).toEqual(
        expect.arrayContaining(["speech", "stt", "local"]),
      );
      expect(tts?.capabilities).toEqual(
        expect.arrayContaining(["speech", "tts", "local"]),
      );
      expect(stt?.id).toBe("speech/stt/whisper");
      expect(tts?.id).toBe("speech/tts/voice");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("SpeechModelManager", () => {
  it("syncs from disk and lists/filters by modality", () => {
    const root = join(tmpdir(), `atlas-speech-mgr-${Date.now()}`);
    mkdirSync(join(root, "speech", "stt"), { recursive: true });
    mkdirSync(join(root, "speech", "tts"), { recursive: true });
    writeToyGguf(join(root, "speech", "stt", "a.gguf"));
    writeFileSync(join(root, "speech", "tts", "b.onnx"), Buffer.alloc(8, 3));

    try {
      const registry = createModelRegistry({ modelsDir: root });
      const manager = createSpeechModelManager({ modelsDir: root, registry });
      expect(manager.syncFromDisk()).toBe(2);
      expect(manager.list()).toHaveLength(2);
      expect(manager.list({ modality: "stt" })).toHaveLength(1);
      expect(manager.list({ modality: "tts" })[0]?.id).toBe("speech/tts/b");
      expect(manager.get("speech/stt/a")?.modality).toBe("stt");
      expect(manager.remove("speech/stt/a")).toBe(true);
      expect(manager.list({ modality: "stt" })).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("mock speech providers", () => {
  it("transcribes and synthesizes without real audio engines", async () => {
    const stt = new MockSpeechToTextProvider({ transcript: "hello atlas" });
    const tts = new MockTextToSpeechProvider();

    const sttHealth = await stt.health();
    const ttsHealth = await tts.health();
    expect(sttHealth.ok).toBe(true);
    expect(ttsHealth.ok).toBe(true);
    expect(stt.id).not.toBe("mock");
    expect(tts.id).not.toBe("mock");

    await stt.load("mock-whisper");
    const transcript = await stt.transcribe({
      data: new Uint8Array([1, 2, 3]),
      mimeType: "audio/wav",
      sampleRateHz: 16000,
    });
    expect(transcript.text).toBe("hello atlas");
    expect(transcript.provider).toBe("mock-stt");

    await tts.load("mock-piper");
    const audio = await tts.synthesize({ text: "spokenText from response" });
    expect(audio.mimeType).toContain("wav");
    expect(audio.data.byteLength).toBeGreaterThanOrEqual(44);
    expect(audio.provider).toBe("mock-tts");
  });
});
