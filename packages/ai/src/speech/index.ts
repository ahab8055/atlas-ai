export type {
  AudioInput,
  AudioOutput,
  SpeechFileEntry,
  SpeechModality,
  SpeechModelFormat,
  SpeechModelInfo,
  SpeechModelMetadata,
  SynthesizeInput,
  TranscriptResult,
} from "./types.js";

export { SPEECH_FILE_EXTENSIONS, SPEECH_MODALITIES } from "./types.js";

export {
  ensureSpeechStructure,
  isSpeechStructureReady,
  listSpeechFiles,
  speechDestinationPath,
  speechModalityPath,
  type EnsureSpeechStructureResult,
} from "./storage.js";

export {
  modalityFromRegistered,
  scanSpeechModels,
  speechMetadataFromFile,
  type ScanSpeechModelsOptions,
} from "./discover.js";

export {
  SpeechModelManager,
  createSpeechModelManager,
  type SpeechModelManagerOptions,
} from "./manager.js";

export type {
  SpeechProviderHealth,
  SpeechToTextProvider,
  TextToSpeechProvider,
} from "./provider.js";

export {
  MockSpeechToTextProvider,
  MockTextToSpeechProvider,
  type MockSpeechToTextOptions,
  type MockTextToSpeechOptions,
} from "./mock.js";
