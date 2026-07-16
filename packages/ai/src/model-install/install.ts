/**
 * Model installation workflow (Architecture/25):
 * Select → Compatibility → Storage → Download/Copy → Validate → Register.
 */
import { copyFileSync, existsSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";

import { AiRuntimeError } from "../errors.js";
import { validateGgufFile } from "../gguf.js";
import { detectHardware } from "../hardware-detection/detect.js";
import type { ModelRegistry } from "../model-registry/registry.js";
import type { RegisterModelInput } from "../model-registry/types.js";
import {
  MODEL_CATEGORIES,
  type ModelCategory,
} from "../model-storage/types.js";
import { ensureModelDirectoryStructure } from "../model-storage/layout.js";
import { checkInstallCompatibility } from "./compatibility.js";
import { downloadModelFile, isHttpUrl } from "./download.js";
import { checkInstallStorage, getFileSizeBytes } from "./storage-check.js";
import type {
  CompatibilityWarning,
  InstallModelInput,
  InstallModelResult,
  InstallSourceKind,
} from "./types.js";

export interface ModelInstallerOptions {
  modelsDir: string;
  registry: ModelRegistry;
  defaultProvider?: string;
  defaultContextLength?: number;
  fetchImpl?: typeof fetch;
}

function assertCategory(value: string | undefined): ModelCategory {
  const category = (value ?? "general") as ModelCategory;
  if (!(MODEL_CATEGORIES as readonly string[]).includes(category)) {
    throw new AiRuntimeError(
      `Unsupported model category "${value}". Use: ${MODEL_CATEGORIES.join(", ")}`,
      { code: "invalid_category" },
    );
  }
  return category;
}

function basenameWithoutGguf(filePath: string): string {
  const base = path.basename(filePath);
  return base.replace(/\.gguf$/i, "") || "model";
}

function destinationPath(
  modelsDir: string,
  category: ModelCategory,
  id: string,
): string {
  const leaf = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
  return path.join(modelsDir, category, `${leaf}.gguf`);
}

export class ModelInstaller {
  private readonly modelsDir: string;
  private readonly registry: ModelRegistry;
  private readonly defaultProvider: string;
  private readonly defaultContextLength: number;
  private readonly fetchImpl?: typeof fetch;

  constructor(options: ModelInstallerOptions) {
    this.modelsDir = path.resolve(options.modelsDir);
    this.registry = options.registry;
    this.defaultProvider = options.defaultProvider ?? "llamacpp";
    this.defaultContextLength = options.defaultContextLength ?? 4096;
    this.fetchImpl = options.fetchImpl;
  }

  /**
   * Install a supported GGUF model from a local path or http(s) URL.
   */
  async install(input: InstallModelInput): Promise<InstallModelResult> {
    const source = input.source.trim();
    if (!source) {
      throw new AiRuntimeError("Install source is required", {
        code: "install_source_required",
      });
    }

    const sourceKind: InstallSourceKind = isHttpUrl(source) ? "url" : "file";
    const category = assertCategory(input.category);
    const proceedOnWarnings = input.proceedOnWarnings !== false;
    const blockOnErrors = input.blockOnErrors !== false;
    const dryRun = input.dryRun === true;

    ensureModelDirectoryStructure(this.modelsDir);

    let workingPath = source;
    let downloadedTemp: string | undefined;
    let sizeBytes: number | undefined;

    try {
      if (sourceKind === "file") {
        workingPath = path.resolve(source);
        if (!existsSync(workingPath)) {
          return this.fail(
            sourceKind,
            source,
            dryRun,
            `Source file not found: ${workingPath}`,
          );
        }
        sizeBytes = getFileSizeBytes(workingPath);
      } else if (!dryRun) {
        const downloaded = await downloadModelFile(source, {
          fetchImpl: this.fetchImpl,
          fileName: input.id ? `${path.basename(input.id)}.gguf` : undefined,
        });
        workingPath = downloaded.path;
        downloadedTemp = downloaded.path;
        sizeBytes = downloaded.sizeBytes;
      } else {
        // Dry-run for URLs: skip download; storage check uses a placeholder if unknown.
        sizeBytes = undefined;
      }

      if (sourceKind === "file" || !dryRun) {
        const validation = validateGgufFile(workingPath);
        if (!validation.ok) {
          return this.fail(
            sourceKind,
            source,
            dryRun,
            `Invalid GGUF: ${validation.reason ?? "validation failed"}`,
            sizeBytes,
          );
        }
        sizeBytes = validation.sizeBytes ?? sizeBytes;
      }

      const hardware = detectHardware();
      const compatibility = checkInstallCompatibility({
        requirements: input.requirements,
        sizeBytes,
        hardware,
      });

      const storage = checkInstallStorage({
        modelsDir: this.modelsDir,
        requiredBytes: sizeBytes ?? 0,
      });

      const warnings: CompatibilityWarning[] = [...compatibility.warnings];
      if (!storage.ok) {
        warnings.push({
          code: "storage_tight",
          severity: "error",
          message: storage.message,
        });
      } else if (
        storage.freeBytes !== undefined &&
        sizeBytes !== undefined &&
        storage.freeBytes < sizeBytes * 2
      ) {
        warnings.push({
          code: "storage_tight",
          severity: "warning",
          message: `Free disk space is tight relative to model size (${storage.message})`,
        });
      }

      const hasError = warnings.some((w) => w.severity === "error");
      if (hasError && blockOnErrors) {
        return {
          ok: false,
          dryRun,
          sourceKind,
          source,
          compatibility: {
            ...compatibility,
            warnings,
            ok: false,
            canProceed: false,
          },
          storage,
          warnings,
          message: "Installation blocked by compatibility/storage errors.",
        };
      }

      if (!compatibility.ok && !proceedOnWarnings && !hasError) {
        return {
          ok: false,
          dryRun,
          sourceKind,
          source,
          compatibility,
          storage,
          warnings,
          message:
            "Installation aborted due to compatibility warnings (set proceedOnWarnings).",
        };
      }

      const leaf = input.id
        ? input.id.includes("/")
          ? input.id.slice(input.id.lastIndexOf("/") + 1)
          : input.id
        : basenameWithoutGguf(
            sourceKind === "url" ? new URL(source).pathname : workingPath,
          );
      const modelId = input.id?.includes("/")
        ? input.id
        : `${category}/${leaf}`;
      const destination = destinationPath(this.modelsDir, category, leaf);

      if (dryRun) {
        return {
          ok: true,
          dryRun: true,
          sourceKind,
          source,
          destination,
          modelId,
          compatibility: { ...compatibility, warnings },
          storage,
          warnings,
          message: `Dry run OK for ${modelId} → ${destination}`,
        };
      }

      if (existsSync(destination) && !input.overwrite) {
        return {
          ok: false,
          dryRun: false,
          sourceKind,
          source,
          destination,
          modelId,
          compatibility: { ...compatibility, warnings },
          storage,
          warnings,
          message: `Destination already exists: ${destination} (pass overwrite to replace)`,
        };
      }

      // Prefer rename when temp download on same volume; else copy.
      if (downloadedTemp) {
        try {
          renameSync(workingPath, destination);
          downloadedTemp = undefined;
        } catch {
          copyFileSync(workingPath, destination);
        }
      } else if (path.resolve(workingPath) !== path.resolve(destination)) {
        copyFileSync(workingPath, destination);
      }

      const finalValidation = validateGgufFile(destination);
      if (!finalValidation.ok) {
        try {
          unlinkSync(destination);
        } catch {
          // ignore cleanup
        }
        return this.fail(
          sourceKind,
          source,
          false,
          `Installed file failed GGUF validation: ${finalValidation.reason}`,
        );
      }

      const registerInput: RegisterModelInput = {
        id: modelId,
        name: input.name ?? modelId,
        provider: input.provider ?? this.defaultProvider,
        version: input.version ?? "1.0.0",
        format: "gguf",
        sizeBytes: finalValidation.sizeBytes,
        contextLength: input.contextLength ?? this.defaultContextLength,
        capabilities: input.capabilities ?? ["chat", "local"],
        requirements: input.requirements ?? {
          acceleration: "cpu",
          notes: "Installed via Atlas model installation workflow",
        },
        location: destination,
        status: "available",
      };
      const registered = this.registry.register(registerInput);

      return {
        ok: true,
        dryRun: false,
        sourceKind,
        source,
        destination,
        modelId,
        registered,
        compatibility: { ...compatibility, warnings },
        storage,
        warnings,
        message: `Installed and registered ${modelId}`,
      };
    } finally {
      if (downloadedTemp) {
        try {
          unlinkSync(downloadedTemp);
        } catch {
          // ignore
        }
      }
    }
  }

  private fail(
    sourceKind: InstallSourceKind,
    source: string,
    dryRun: boolean,
    message: string,
    sizeBytes?: number,
  ): InstallModelResult {
    const hardware = detectHardware({ skipGpuProbe: true });
    const compatibility = checkInstallCompatibility({
      sizeBytes,
      hardware,
    });
    const storage = checkInstallStorage({
      modelsDir: this.modelsDir,
      requiredBytes: sizeBytes ?? 0,
    });
    return {
      ok: false,
      dryRun,
      sourceKind,
      source,
      compatibility,
      storage,
      warnings: compatibility.warnings,
      message,
    };
  }
}

export function createModelInstaller(
  options: ModelInstallerOptions,
): ModelInstaller {
  return new ModelInstaller(options);
}

export async function installModel(
  options: ModelInstallerOptions & { input: InstallModelInput },
): Promise<InstallModelResult> {
  const { input, ...installerOptions } = options;
  return createModelInstaller(installerOptions).install(input);
}
