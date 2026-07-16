/**
 * Model installation workflow types (Architecture/25 Installation System).
 */
import type { ModelCategory } from "../model-storage/types.js";
import type {
  ModelRequirements,
  RegisteredModel,
} from "../model-registry/types.js";
import type { DetectedHardware } from "../hardware-detection/types.js";
import type { ResourceProfileId } from "../hardware-detection/resource-profiles.js";

export type InstallSourceKind = "file" | "url";

export interface CompatibilityWarning {
  code:
    | "low_ram"
    | "gpu_required"
    | "gpu_layers"
    | "profile_size"
    | "os_arch"
    | "storage_tight"
    | "other";
  message: string;
  severity: "warning" | "error";
}

export interface CompatibilityReport {
  ok: boolean;
  /** True when only warnings (no blocking errors) — install may proceed. */
  canProceed: boolean;
  warnings: CompatibilityWarning[];
  hardware: DetectedHardware;
  profileId: ResourceProfileId;
}

export interface StorageCheckResult {
  ok: boolean;
  modelsDir: string;
  requiredBytes: number;
  freeBytes?: number;
  freeGb?: number;
  message: string;
}

export interface InstallModelInput {
  /** Local filesystem path or http(s) URL to a .gguf file. */
  source: string;
  /** Target category under models/ (default general). */
  category?: ModelCategory;
  /**
   * When category is `speech`, place under speech/stt or speech/tts (default stt).
   */
  speechModality?: "stt" | "tts";
  /** Optional explicit model id (default: category/basename). */
  id?: string;
  name?: string;
  version?: string;
  provider?: string;
  capabilities?: string[];
  requirements?: ModelRequirements;
  contextLength?: number;
  /** Proceed even when compatibility reports warnings. Default true (Arch shows Warning). */
  proceedOnWarnings?: boolean;
  /** Fail when any compatibility warning has severity error. Default true. */
  blockOnErrors?: boolean;
  /** Overwrite existing destination file. */
  overwrite?: boolean;
  /** Skip download/copy; only run compatibility + storage checks. */
  dryRun?: boolean;
  /**
   * When true, block http(s) model installs (features.offlineMode).
   * Loopback URLs remain allowed.
   */
  offlineMode?: boolean;
}

export interface InstallModelResult {
  ok: boolean;
  dryRun: boolean;
  sourceKind: InstallSourceKind;
  source: string;
  destination?: string;
  modelId?: string;
  registered?: RegisteredModel;
  compatibility: CompatibilityReport;
  storage: StorageCheckResult;
  warnings: CompatibilityWarning[];
  message: string;
}
