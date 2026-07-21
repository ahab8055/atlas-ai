/**
 * Real file.* tools backed by FileAccessService (ADR-0074).
 */
import {
  getDefaultFileAccessService,
  type FileAccessService,
} from "@atlas-ai/filesystem";
import { isPlatformError } from "@atlas-ai/platform";

import { defineTool } from "./define.js";
import type { ToolResult } from "../types.js";

function access(): FileAccessService {
  return getDefaultFileAccessService();
}

function fail(error: unknown): ToolResult {
  const message =
    error instanceof Error ? error.message : "File operation failed";
  const code = isPlatformError(error) ? error.code : "unknown";
  return {
    ok: false,
    message,
    error: message,
    data: { code },
  };
}

export const fileSearch = defineTool(
  {
    name: "file.search",
    description:
      "Search local files by name (glob * / ?) with optional extension, depth, and content filters",
    version: "1.2.0",
    permissions: ["filesystem.read"],
    risk: "medium",
    tags: ["filesystem", "mvp", "search"],
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        root: { type: "string" },
        content: { type: "boolean" },
        limit: { type: "number" },
        maxDepth: { type: "number" },
        includeHidden: { type: "boolean" },
        extensions: { type: "array", items: { type: "string" } },
        filesOnly: { type: "boolean" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "hits"],
      properties: {
        message: { type: "string" },
        query: { type: "string" },
        hits: { type: "array" },
        truncated: { type: "boolean" },
        scannedEntries: { type: "number" },
        durationMs: { type: "number" },
      },
    },
  },
  (input) => {
    try {
      const query = String(input.query ?? "");
      const extensions = Array.isArray(input.extensions)
        ? input.extensions.map((e) => String(e))
        : undefined;
      const result = access().findFiles({
        pattern: query,
        root: input.root !== undefined ? String(input.root) : undefined,
        content: Boolean(input.content),
        limit: typeof input.limit === "number" ? input.limit : undefined,
        maxDepth:
          typeof input.maxDepth === "number" ? input.maxDepth : undefined,
        includeHidden:
          input.includeHidden === undefined
            ? undefined
            : Boolean(input.includeHidden),
        extensions,
        filesOnly:
          input.filesOnly === undefined ? undefined : Boolean(input.filesOnly),
      });
      const message =
        result.hits.length === 0
          ? `No files matched "${query}"`
          : `Found ${result.hits.length} file(s) matching "${query}"${result.truncated ? " (truncated)" : ""}`;
      return {
        ok: true,
        message,
        data: {
          message,
          query,
          truncated: result.truncated,
          scannedEntries: result.scannedEntries,
          durationMs: result.durationMs,
          hits: result.hits.map((h) => ({
            path: h.path,
            name: h.name,
            match: h.match,
            isFile: h.isFile,
            isDirectory: h.isDirectory,
            isSymbolicLink: h.isSymbolicLink,
            size: h.size,
            mtimeMs: h.mtimeMs,
            extension: h.extension,
          })),
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileRead = defineTool(
  {
    name: "file.read",
    description: "Read a local text file",
    version: "1.0.0",
    permissions: ["filesystem.read"],
    risk: "medium",
    tags: ["filesystem", "mvp"],
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "path", "content"],
      properties: {
        message: { type: "string" },
        path: { type: "string" },
        content: { type: "string" },
        size: { type: "number" },
      },
    },
  },
  (input) => {
    try {
      const result = access().readFile(String(input.path ?? ""));
      const message = `Read ${result.path} (${result.size} bytes)`;
      return {
        ok: true,
        message,
        data: {
          message,
          path: result.path,
          content: result.content,
          size: result.size,
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileWrite = defineTool(
  {
    name: "file.write",
    description: "Create or modify a local text file",
    version: "1.0.0",
    permissions: ["filesystem.write"],
    risk: "high",
    tags: ["filesystem", "mvp"],
    inputSchema: {
      type: "object",
      required: ["path", "content"],
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        createDirs: { type: "boolean" },
        overwrite: { type: "boolean" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "path"],
      properties: {
        message: { type: "string" },
        path: { type: "string" },
      },
    },
  },
  (input) => {
    try {
      const filePath = String(input.path ?? "");
      access().writeFile(filePath, String(input.content ?? ""), {
        createDirs:
          input.createDirs === undefined
            ? undefined
            : Boolean(input.createDirs),
        overwrite:
          input.overwrite === undefined ? undefined : Boolean(input.overwrite),
      });
      const message = `Wrote ${filePath}`;
      return { ok: true, message, data: { message, path: filePath } };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileMkdir = defineTool(
  {
    name: "file.mkdir",
    description: "Create a directory (including parents)",
    version: "1.0.0",
    permissions: ["filesystem.write"],
    risk: "high",
    tags: ["filesystem", "mvp"],
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "path"],
      properties: {
        message: { type: "string" },
        path: { type: "string" },
      },
    },
  },
  (input) => {
    try {
      const filePath = String(input.path ?? "");
      access().createDirectory(filePath);
      const message = `Created directory ${filePath}`;
      return { ok: true, message, data: { message, path: filePath } };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileDelete = defineTool(
  {
    name: "file.delete",
    description: "Delete a local file or directory",
    version: "1.0.0",
    permissions: ["filesystem.delete"],
    risk: "critical",
    tags: ["filesystem", "mvp"],
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "path"],
      properties: {
        message: { type: "string" },
        path: { type: "string" },
      },
    },
  },
  (input) => {
    try {
      const filePath = String(input.path ?? "");
      access().deleteFile(filePath);
      const message = `Deleted ${filePath}`;
      return { ok: true, message, data: { message, path: filePath } };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileMove = defineTool(
  {
    name: "file.move",
    description: "Move or rename a local file",
    version: "1.0.0",
    permissions: ["filesystem.write", "filesystem.delete"],
    risk: "high",
    tags: ["filesystem", "mvp"],
    inputSchema: {
      type: "object",
      required: ["from", "to"],
      properties: {
        from: { type: "string" },
        to: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "from", "to"],
      properties: {
        message: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
      },
    },
  },
  (input) => {
    try {
      const from = String(input.from ?? "");
      const to = String(input.to ?? "");
      access().moveFile(from, to);
      const message = `Moved ${from} → ${to}`;
      return { ok: true, message, data: { message, from, to } };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileResolve = defineTool(
  {
    name: "file.resolve",
    description: "Resolve a relative or absolute path within Atlas file roots",
    version: "1.0.0",
    permissions: ["filesystem.read"],
    risk: "medium",
    tags: ["filesystem", "mvp", "navigation"],
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "path"],
      properties: {
        message: { type: "string" },
        path: { type: "string" },
      },
    },
  },
  (input) => {
    try {
      const resolved = access().resolvePath(String(input.path ?? ""));
      const message = `Resolved to ${resolved}`;
      return { ok: true, message, data: { message, path: resolved } };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileList = defineTool(
  {
    name: "file.list",
    description: "List entries in a directory (does not follow nested folders)",
    version: "1.0.0",
    permissions: ["filesystem.read"],
    risk: "medium",
    tags: ["filesystem", "mvp", "navigation"],
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        includeHidden: { type: "boolean" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "entries"],
      properties: {
        message: { type: "string" },
        path: { type: "string" },
        entries: { type: "array" },
      },
    },
  },
  (input) => {
    try {
      const dirPath = input.path !== undefined ? String(input.path) : undefined;
      const entries = access().listDirectory(dirPath, {
        includeHidden:
          input.includeHidden === undefined
            ? undefined
            : Boolean(input.includeHidden),
      });
      const message = `Listed ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`;
      return {
        ok: true,
        message,
        data: {
          message,
          path: dirPath ?? "",
          entries: entries.map((e) => ({
            path: e.path,
            name: e.name,
            isFile: e.isFile,
            isDirectory: e.isDirectory,
            isSymbolicLink: e.isSymbolicLink,
            size: e.size,
            linkTarget: e.linkTarget,
          })),
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileWalk = defineTool(
  {
    name: "file.walk",
    description:
      "Walk a directory tree (symlinks not followed unless followSymlinks is true)",
    version: "1.0.0",
    permissions: ["filesystem.read"],
    risk: "medium",
    tags: ["filesystem", "mvp", "navigation"],
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        maxDepth: { type: "number" },
        followSymlinks: { type: "boolean" },
        includeHidden: { type: "boolean" },
        limit: { type: "number" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "entries"],
      properties: {
        message: { type: "string" },
        path: { type: "string" },
        entries: { type: "array" },
      },
    },
  },
  (input) => {
    try {
      const dirPath = input.path !== undefined ? String(input.path) : undefined;
      const entries = access().walkDirectory(dirPath, {
        maxDepth:
          typeof input.maxDepth === "number" ? input.maxDepth : undefined,
        followSymlinks:
          input.followSymlinks === undefined
            ? undefined
            : Boolean(input.followSymlinks),
        includeHidden:
          input.includeHidden === undefined
            ? undefined
            : Boolean(input.includeHidden),
        limit: typeof input.limit === "number" ? input.limit : undefined,
      });
      const message = `Walked ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`;
      return {
        ok: true,
        message,
        data: {
          message,
          path: dirPath ?? "",
          entries: entries.map((e) => ({
            path: e.path,
            name: e.name,
            isFile: e.isFile,
            isDirectory: e.isDirectory,
            isSymbolicLink: e.isSymbolicLink,
            size: e.size,
            linkTarget: e.linkTarget,
          })),
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileMetadata = defineTool(
  {
    name: "file.metadata",
    description:
      "Retrieve unified metadata for a file or directory (size, dates, MIME, checksum)",
    version: "1.0.0",
    permissions: ["filesystem.read"],
    risk: "medium",
    tags: ["filesystem", "mvp", "metadata"],
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
        followSymlinks: { type: "boolean" },
        includeChecksum: { type: "boolean" },
        maxChecksumBytes: { type: "number" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "metadata"],
      properties: {
        message: { type: "string" },
        metadata: { type: "object" },
      },
    },
  },
  (input) => {
    try {
      const filePath = String(input.path ?? "");
      const metadata = access().getFileMetadata(filePath, {
        followSymlinks:
          input.followSymlinks === undefined
            ? undefined
            : Boolean(input.followSymlinks),
        includeChecksum:
          input.includeChecksum === undefined
            ? undefined
            : Boolean(input.includeChecksum),
        maxChecksumBytes:
          typeof input.maxChecksumBytes === "number"
            ? input.maxChecksumBytes
            : undefined,
      });
      const message = `Metadata for ${metadata.path} (${metadata.mimeType})`;
      return {
        ok: true,
        message,
        data: {
          message,
          metadata: {
            path: metadata.path,
            name: metadata.name,
            extension: metadata.extension,
            size: metadata.size,
            isFile: metadata.isFile,
            isDirectory: metadata.isDirectory,
            isSymbolicLink: metadata.isSymbolicLink,
            createdAtMs: metadata.createdAtMs,
            modifiedAtMs: metadata.modifiedAtMs,
            mode: metadata.mode,
            permissions: metadata.permissions,
            owner: metadata.owner,
            mimeType: metadata.mimeType,
            checksum: metadata.checksum,
            checksumSkipped: metadata.checksumSkipped,
          },
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);
