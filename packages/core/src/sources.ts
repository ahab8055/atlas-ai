/**
 * Request sources. CLI is first; desktop and voice reuse the same pipeline.
 */
export type InputSource = "cli" | "desktop" | "voice" | "api";
