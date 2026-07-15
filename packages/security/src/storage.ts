/**
 * Secure storage approach for MVP secrets.
 * Concrete OS keychain adapters (macOS Keychain, Windows Credential Manager,
 * Linux Secret Service) plug into this interface later.
 */

export type SecretKind =
  "api_key" | "token" | "password" | "encryption_key" | "other";

export interface SecretRef {
  /** Stable logical id, e.g. "openai.api_key". */
  id: string;
  kind: SecretKind;
}

export interface SecureStorageProvider {
  readonly name: string;
  getSecret(ref: SecretRef): Promise<string | undefined>;
  setSecret(ref: SecretRef, value: string): Promise<void>;
  deleteSecret(ref: SecretRef): Promise<void>;
}

/**
 * In-memory provider for tests only — never use for real secrets.
 */
export class MemorySecureStorage implements SecureStorageProvider {
  readonly name = "memory-test";
  private readonly store = new Map<string, string>();

  async getSecret(ref: SecretRef): Promise<string | undefined> {
    return this.store.get(ref.id);
  }

  async setSecret(ref: SecretRef, value: string): Promise<void> {
    this.store.set(ref.id, value);
  }

  async deleteSecret(ref: SecretRef): Promise<void> {
    this.store.delete(ref.id);
  }
}

/**
 * Placeholder for OS keychain wiring.
 * Throws until a platform adapter is registered.
 */
export class UnconfiguredSecureStorage implements SecureStorageProvider {
  readonly name = "unconfigured";

  async getSecret(): Promise<string | undefined> {
    throw new Error(
      "SecureStorage not configured. Use OS keychain adapter (MVP) — see docs/guides/Security.md",
    );
  }

  async setSecret(): Promise<void> {
    throw new Error(
      "SecureStorage not configured. Use OS keychain adapter (MVP) — see docs/guides/Security.md",
    );
  }

  async deleteSecret(): Promise<void> {
    throw new Error(
      "SecureStorage not configured. Use OS keychain adapter (MVP) — see docs/guides/Security.md",
    );
  }
}
