/**
 * PlatformServiceRegistry — resolve OS/platform services without provider imports
 * (ADR-0067).
 */
import { emitPlatformEvent } from "./events.js";
import {
  createPlatformManager,
  getDefaultPlatformManager,
  setDefaultPlatformManager,
  type PlatformManager,
  type PlatformManagerOptions,
} from "./manager.js";
import type {
  ApplicationService,
  ClipboardService,
  FileSystemService,
  NotificationService,
  OperatingSystem,
  SystemInformationService,
  TerminalService,
} from "./os/types.js";
import type {
  EnvService,
  FsService,
  PathService,
  PlatformInfo,
  PlatformServices,
} from "./types.js";

export type PlatformServiceKey =
  | "info"
  | "paths"
  | "env"
  | "fs"
  | "os"
  | "os.applications"
  | "os.files"
  | "os.terminal"
  | "os.notifications"
  | "os.clipboard"
  | "os.system"
  | "os.paths"
  | "os.env";

export type PlatformServiceResolved = {
  info: PlatformInfo;
  paths: PathService;
  env: EnvService;
  fs: FsService;
  os: OperatingSystem;
  "os.applications": ApplicationService;
  "os.files": FileSystemService;
  "os.terminal": TerminalService;
  "os.notifications": NotificationService;
  "os.clipboard": ClipboardService;
  "os.system": SystemInformationService;
  "os.paths": PathService;
  "os.env": EnvService;
};

export interface RegisterPlatformServicesOptions {
  /** Replace an existing registration. Required when services are already set. */
  replace?: boolean;
}

/**
 * Lookup / DI surface for platform services. PlatformManager remains the factory;
 * this registry is how modules resolve services without importing OS providers.
 */
export class PlatformServiceRegistry {
  private services: PlatformServices | undefined;

  register(
    services: PlatformServices,
    options: RegisterPlatformServicesOptions = {},
  ): void {
    if (this.services && !options.replace) {
      throw new Error(
        "Platform services are already registered; pass { replace: true } to overwrite",
      );
    }
    this.services = services;
  }

  registerFromManager(
    manager: PlatformManager,
    options: RegisterPlatformServicesOptions = {},
  ): void {
    this.register(manager.getServices(), options);
  }

  has(key: PlatformServiceKey): boolean {
    this.ensureRegistered();
    return this.lookup(key) !== undefined;
  }

  resolve<K extends PlatformServiceKey>(key: K): PlatformServiceResolved[K] {
    this.ensureRegistered();
    const value = this.lookup(key);
    if (value === undefined) {
      throw new Error(`Platform service "${key}" is not registered`);
    }
    return value as PlatformServiceResolved[K];
  }

  tryResolve(key: PlatformServiceKey): unknown | undefined {
    try {
      this.ensureRegistered();
    } catch {
      return undefined;
    }
    return this.lookup(key);
  }

  getServices(): PlatformServices {
    this.ensureRegistered();
    return this.services!;
  }

  getOs(): OperatingSystem {
    return this.resolve("os");
  }

  getPaths(): PathService {
    return this.resolve("paths");
  }

  getEnv(): EnvService {
    return this.resolve("env");
  }

  getFs(): FsService {
    return this.resolve("fs");
  }

  getInfo(): PlatformInfo {
    return this.resolve("info");
  }

  /** Clears registration (tests). Next resolve may lazy-bootstrap again. */
  clear(): void {
    this.services = undefined;
  }

  private ensureRegistered(): void {
    if (this.services) {
      return;
    }
    // Lazy fallback: bootstrap once from the default PlatformManager.
    this.services = getDefaultPlatformManager().getServices();
  }

  private lookup(key: PlatformServiceKey): unknown {
    if (!this.services) {
      return undefined;
    }
    const { info, paths, env, fs, os } = this.services;
    switch (key) {
      case "info":
        return info;
      case "paths":
        return paths;
      case "env":
        return env;
      case "fs":
        return fs;
      case "os":
        return os;
      case "os.applications":
        return os.applications;
      case "os.files":
        return os.files;
      case "os.terminal":
        return os.terminal;
      case "os.notifications":
        return os.notifications;
      case "os.clipboard":
        return os.clipboard;
      case "os.system":
        return os.system;
      case "os.paths":
        return os.paths;
      case "os.env":
        return os.env;
      default: {
        const _exhaustive: never = key;
        return _exhaustive;
      }
    }
  }
}

let defaultRegistry: PlatformServiceRegistry | undefined;

export function getDefaultPlatformServiceRegistry(): PlatformServiceRegistry {
  defaultRegistry ??= new PlatformServiceRegistry();
  return defaultRegistry;
}

export function setDefaultPlatformServiceRegistry(
  registry: PlatformServiceRegistry,
): void {
  defaultRegistry = registry;
}

/** Test helper — clears the lazy singleton registry. */
export function __resetDefaultPlatformServiceRegistryForTests(): void {
  defaultRegistry = undefined;
}

/**
 * Startup helper: create PlatformManager, set it as default, register services
 * on the default registry (replace), and return that registry.
 */
export function bootstrapPlatformServices(
  options: PlatformManagerOptions = {},
): PlatformServiceRegistry {
  const manager = createPlatformManager(options);
  setDefaultPlatformManager(manager);
  const registry = getDefaultPlatformServiceRegistry();
  registry.registerFromManager(manager, { replace: true });
  emitPlatformEvent(options.onPlatformEvent, "PlatformServicesStarted", {
    platformId: manager.platformId,
    via: "bootstrap",
  });
  return registry;
}
