/**
 * Extension → MIME type map (no external deps). ADR-0077.
 */

const EXT_MIME: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".json": "application/json",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".cjs": "text/javascript",
  ".ts": "text/typescript",
  ".tsx": "text/tsx",
  ".jsx": "text/jsx",
  ".css": "text/css",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".toml": "application/toml",
  ".csv": "text/csv",
  ".sh": "application/x-sh",
  ".py": "text/x-python",
  ".rs": "text/x-rust",
  ".go": "text/x-go",
};

export function mimeFromExtension(extension: string): string {
  if (!extension) {
    return "application/octet-stream";
  }
  const key = extension.startsWith(".")
    ? extension.toLowerCase()
    : `.${extension.toLowerCase()}`;
  return EXT_MIME[key] ?? "application/octet-stream";
}

export function mimeForEntry(options: {
  isDirectory: boolean;
  isSymbolicLink: boolean;
  extension: string;
}): string {
  if (options.isDirectory) {
    return "inode/directory";
  }
  if (options.isSymbolicLink) {
    return "inode/symlink";
  }
  return mimeFromExtension(options.extension);
}
