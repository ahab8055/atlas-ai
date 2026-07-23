/**
 * Real file.* tools backed by FileAccessService (ADR-0074 / 0083).
 */
import {
  getDefaultFileAccessService,
  listRecentFiles,
  withFsConfirmRetry,
  type FileAccessService,
} from "@atlas-ai/filesystem";
import { searchIndexedFiles } from "@atlas-ai/search";
import { isPlatformError } from "@atlas-ai/platform";

import { defineTool } from "./define.js";
import type { ToolResult } from "../types.js";

function access(): FileAccessService {
  return getDefaultFileAccessService();
}

function callFs<T>(fn: (fs: FileAccessService) => T): T {
  return withFsConfirmRetry(() => fn(access()));
}

function fail(error: unknown): ToolResult {
  const message =
    error instanceof Error ? error.message : "File operation failed";
  const code = isPlatformError(error) ? error.code : "unknown";
  const approvalId = isPlatformError(error) ? error.approvalId : undefined;
  return {
    ok: false,
    message,
    error: message,
    data: {
      code,
      ...(approvalId !== undefined ? { approvalId } : {}),
    },
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
        respectIgnore: { type: "boolean" },
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
      const result = callFs((fs) =>
        fs.findFiles({
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
            input.filesOnly === undefined
              ? undefined
              : Boolean(input.filesOnly),
          respectIgnore:
            input.respectIgnore === undefined
              ? undefined
              : Boolean(input.respectIgnore),
        }),
      );
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
    description:
      "Read a local file with format detection, encoding, and optional structured parse",
    version: "1.1.0",
    permissions: ["filesystem.read"],
    risk: "medium",
    tags: ["filesystem", "mvp", "reading"],
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
        offset: { type: "number" },
        maxBytes: { type: "number" },
        parse: { type: "boolean" },
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
        format: { type: "string" },
        mimeType: { type: "string" },
        encoding: { type: "string" },
        byteOffset: { type: "number" },
        byteLength: { type: "number" },
        truncated: { type: "boolean" },
        data: {},
        parseError: { type: "string" },
      },
    },
  },
  (input) => {
    try {
      const result = callFs((fs) =>
        fs.readFile(String(input.path ?? ""), {
          offset: typeof input.offset === "number" ? input.offset : undefined,
          maxBytes:
            typeof input.maxBytes === "number" ? input.maxBytes : undefined,
          parse: input.parse === undefined ? undefined : Boolean(input.parse),
        }),
      );
      const message = `Read ${result.path} (${result.format}, ${result.byteLength} bytes${result.truncated ? ", truncated" : ""})`;
      return {
        ok: true,
        message,
        data: {
          message,
          path: result.path,
          content: result.content,
          size: result.size,
          format: result.format,
          mimeType: result.mimeType,
          encoding: result.encoding,
          byteOffset: result.byteOffset,
          byteLength: result.byteLength,
          truncated: result.truncated,
          data: result.data,
          parseError: result.parseError,
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
    description:
      "Create or modify a local file (create/overwrite/append, encoding, atomic)",
    version: "1.1.0",
    permissions: ["filesystem.write"],
    risk: "high",
    tags: ["filesystem", "mvp", "writing"],
    inputSchema: {
      type: "object",
      required: ["path", "content"],
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        createDirs: { type: "boolean" },
        mode: { type: "string" },
        overwrite: { type: "boolean" },
        encoding: { type: "string" },
        atomic: { type: "boolean" },
        bom: { type: "boolean" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "path"],
      properties: {
        message: { type: "string" },
        path: { type: "string" },
        bytesWritten: { type: "number" },
        encoding: { type: "string" },
        mode: { type: "string" },
        atomic: { type: "boolean" },
        created: { type: "boolean" },
      },
    },
  },
  (input) => {
    try {
      const filePath = String(input.path ?? "");
      const modeRaw = input.mode !== undefined ? String(input.mode) : undefined;
      const mode =
        modeRaw === "create" || modeRaw === "overwrite" || modeRaw === "append"
          ? modeRaw
          : undefined;
      const encodingRaw =
        input.encoding !== undefined ? String(input.encoding) : undefined;
      const encoding =
        encodingRaw === "utf-8" ||
        encodingRaw === "utf-16le" ||
        encodingRaw === "utf-16be"
          ? encodingRaw
          : undefined;
      const result = callFs((fs) =>
        fs.writeFile(filePath, String(input.content ?? ""), {
          createDirs:
            input.createDirs === undefined
              ? undefined
              : Boolean(input.createDirs),
          mode,
          overwrite:
            input.overwrite === undefined
              ? undefined
              : Boolean(input.overwrite),
          encoding,
          atomic:
            input.atomic === undefined ? undefined : Boolean(input.atomic),
          bom: input.bom === undefined ? undefined : Boolean(input.bom),
        }),
      );
      const message = `Wrote ${result.path} (${result.mode}, ${result.bytesWritten} bytes)`;
      return {
        ok: true,
        message,
        data: {
          message,
          path: result.path,
          bytesWritten: result.bytesWritten,
          encoding: result.encoding,
          mode: result.mode,
          atomic: result.atomic,
          created: result.created,
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileMkdir = defineTool(
  {
    name: "file.mkdir",
    description: "Create a directory (including parents by default)",
    version: "1.1.0",
    permissions: ["filesystem.write"],
    risk: "high",
    tags: ["filesystem", "mvp", "directory"],
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
        recursive: { type: "boolean" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "path"],
      properties: {
        message: { type: "string" },
        path: { type: "string" },
        created: { type: "boolean" },
      },
    },
  },
  (input) => {
    try {
      const filePath = String(input.path ?? "");
      const result = callFs((fs) =>
        fs.createDirectory(filePath, {
          recursive:
            input.recursive === undefined
              ? undefined
              : Boolean(input.recursive),
        }),
      );
      const message = result.created
        ? `Created directory ${result.path}`
        : `Directory already exists ${result.path}`;
      return {
        ok: true,
        message,
        data: {
          message,
          path: result.path,
          created: result.created,
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileDelete = defineTool(
  {
    name: "file.delete",
    description:
      "Delete a local file or directory (soft-delete to Atlas trash by default)",
    version: "1.1.0",
    permissions: ["filesystem.delete"],
    risk: "critical",
    tags: ["filesystem", "mvp"],
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
        trash: { type: "boolean" },
        recursive: { type: "boolean" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "path"],
      properties: {
        message: { type: "string" },
        path: { type: "string" },
        kind: { type: "string" },
        mode: { type: "string" },
        trashId: { type: "string" },
        restorable: { type: "boolean" },
      },
    },
  },
  (input) => {
    try {
      const filePath = String(input.path ?? "");
      const result = callFs((fs) =>
        fs.deletePath(filePath, {
          trash: input.trash === undefined ? undefined : Boolean(input.trash),
          recursive:
            input.recursive === undefined
              ? undefined
              : Boolean(input.recursive),
        }),
      );
      const message =
        result.mode === "trash"
          ? `Trashed ${result.kind} ${result.path} (id=${result.trashId})`
          : `Hard-deleted ${result.kind} ${result.path}`;
      return {
        ok: true,
        message,
        data: {
          message,
          path: result.path,
          kind: result.kind,
          mode: result.mode,
          trashId: result.trashId,
          restorable: result.restorable,
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileMove = defineTool(
  {
    name: "file.move",
    description: "Move or rename a local file or directory",
    version: "1.1.0",
    permissions: ["filesystem.write", "filesystem.delete"],
    risk: "high",
    tags: ["filesystem", "mvp", "directory"],
    inputSchema: {
      type: "object",
      required: ["from", "to"],
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        createDirs: { type: "boolean" },
        overwrite: { type: "boolean" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "from", "to"],
      properties: {
        message: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        kind: { type: "string" },
      },
    },
  },
  (input) => {
    try {
      const from = String(input.from ?? "");
      const to = String(input.to ?? "");
      const result = callFs((fs) =>
        fs.movePath(from, to, {
          createDirs:
            input.createDirs === undefined
              ? undefined
              : Boolean(input.createDirs),
          overwrite:
            input.overwrite === undefined
              ? undefined
              : Boolean(input.overwrite),
        }),
      );
      const message = `Moved ${result.kind} ${result.from} → ${result.to}`;
      return {
        ok: true,
        message,
        data: {
          message,
          from: result.from,
          to: result.to,
          kind: result.kind,
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileCopy = defineTool(
  {
    name: "file.copy",
    description: "Copy a local file or directory",
    version: "1.0.0",
    permissions: ["filesystem.write"],
    risk: "high",
    tags: ["filesystem", "mvp"],
    inputSchema: {
      type: "object",
      required: ["from", "to"],
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        createDirs: { type: "boolean" },
        overwrite: { type: "boolean" },
        recursive: { type: "boolean" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "from", "to"],
      properties: {
        message: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        kind: { type: "string" },
        bytesCopied: { type: "number" },
        overwritten: { type: "boolean" },
      },
    },
  },
  (input) => {
    try {
      const from = String(input.from ?? "");
      const to = String(input.to ?? "");
      const result = callFs((fs) =>
        fs.copyPath(from, to, {
          createDirs:
            input.createDirs === undefined
              ? undefined
              : Boolean(input.createDirs),
          overwrite:
            input.overwrite === undefined
              ? undefined
              : Boolean(input.overwrite),
          recursive:
            input.recursive === undefined
              ? undefined
              : Boolean(input.recursive),
        }),
      );
      const message = `Copied ${result.kind} ${result.from} → ${result.to}`;
      return {
        ok: true,
        message,
        data: {
          message,
          from: result.from,
          to: result.to,
          kind: result.kind,
          bytesCopied: result.bytesCopied,
          overwritten: result.overwritten,
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileRename = defineTool(
  {
    name: "file.rename",
    description: "Rename or move a local file or directory",
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
        createDirs: { type: "boolean" },
        overwrite: { type: "boolean" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "from", "to"],
      properties: {
        message: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        kind: { type: "string" },
      },
    },
  },
  (input) => {
    try {
      const from = String(input.from ?? "");
      const to = String(input.to ?? "");
      const result = callFs((fs) =>
        fs.renamePath(from, to, {
          createDirs:
            input.createDirs === undefined
              ? undefined
              : Boolean(input.createDirs),
          overwrite:
            input.overwrite === undefined
              ? undefined
              : Boolean(input.overwrite),
        }),
      );
      const message = `Renamed ${result.kind} ${result.from} → ${result.to}`;
      return {
        ok: true,
        message,
        data: {
          message,
          from: result.from,
          to: result.to,
          kind: result.kind,
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileRestore = defineTool(
  {
    name: "file.restore",
    description: "Restore a soft-deleted path from Atlas trash by trash id",
    version: "1.0.0",
    permissions: ["filesystem.write", "filesystem.delete"],
    risk: "high",
    tags: ["filesystem", "mvp"],
    inputSchema: {
      type: "object",
      required: ["trashId"],
      properties: {
        trashId: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "path", "trashId"],
      properties: {
        message: { type: "string" },
        path: { type: "string" },
        trashId: { type: "string" },
        kind: { type: "string" },
      },
    },
  },
  (input) => {
    try {
      const trashId = String(input.trashId ?? "");
      const result = callFs((fs) => fs.restorePath(trashId));
      const message = `Restored ${result.kind} ${result.path}`;
      return {
        ok: true,
        message,
        data: {
          message,
          path: result.path,
          trashId: result.trashId,
          kind: result.kind,
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileRmdir = defineTool(
  {
    name: "file.rmdir",
    description: "Delete an empty directory",
    version: "1.0.0",
    permissions: ["filesystem.delete"],
    risk: "high",
    tags: ["filesystem", "mvp", "directory"],
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
      callFs((fs) => fs.deleteDirectory(filePath));
      const message = `Removed empty directory ${filePath}`;
      return { ok: true, message, data: { message, path: filePath } };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileExists = defineTool(
  {
    name: "file.exists",
    description:
      "Check whether a path exists and whether it is a file or directory",
    version: "1.0.0",
    permissions: ["filesystem.read"],
    risk: "low",
    tags: ["filesystem", "mvp", "directory"],
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "path", "exists"],
      properties: {
        message: { type: "string" },
        path: { type: "string" },
        exists: { type: "boolean" },
        isFile: { type: "boolean" },
        isDirectory: { type: "boolean" },
      },
    },
  },
  (input) => {
    try {
      const filePath = String(input.path ?? "");
      const absolute = callFs((fs) => fs.resolvePath(filePath));
      const info = callFs((fs) => fs.pathExists(filePath));
      const message = info.exists
        ? `${absolute} exists (${info.isDirectory ? "directory" : "file"})`
        : `${absolute} does not exist`;
      return {
        ok: true,
        message,
        data: {
          message,
          path: absolute,
          exists: info.exists,
          isFile: info.isFile,
          isDirectory: info.isDirectory,
        },
      };
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
      const resolved = callFs((fs) => fs.resolvePath(String(input.path ?? "")));
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
        respectIgnore: { type: "boolean" },
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
      const entries = callFs((fs) =>
        fs.listDirectory(dirPath, {
          includeHidden:
            input.includeHidden === undefined
              ? undefined
              : Boolean(input.includeHidden),
          respectIgnore:
            input.respectIgnore === undefined
              ? undefined
              : Boolean(input.respectIgnore),
        }),
      );
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
        respectIgnore: { type: "boolean" },
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
      const entries = callFs((fs) =>
        fs.walkDirectory(dirPath, {
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
          respectIgnore:
            input.respectIgnore === undefined
              ? undefined
              : Boolean(input.respectIgnore),
        }),
      );
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
      const metadata = callFs((fs) =>
        fs.getFileMetadata(filePath, {
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
        }),
      );
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

export const fileRecent = defineTool(
  {
    name: "file.recent",
    description:
      "List recently accessed files (MRU) with timestamps and access frequency",
    version: "1.0.0",
    permissions: ["filesystem.read"],
    risk: "low",
    tags: ["filesystem", "mvp", "recent"],
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        sort: { type: "string", description: "recent | frequent" },
        pathPrefix: { type: "string" },
        action: { type: "string", description: "read | write" },
        since: { type: "string", description: "ISO timestamp lower bound" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "files"],
      properties: {
        message: { type: "string" },
        files: { type: "array" },
      },
    },
  },
  (input) => {
    try {
      const sortRaw = input.sort !== undefined ? String(input.sort) : "recent";
      const sort =
        sortRaw === "frequent" ? ("frequent" as const) : ("recent" as const);
      const actionRaw =
        input.action !== undefined ? String(input.action) : undefined;
      const action =
        actionRaw === "read" || actionRaw === "write" ? actionRaw : undefined;
      const files = listRecentFiles({
        limit: typeof input.limit === "number" ? input.limit : undefined,
        sort,
        pathPrefix:
          input.pathPrefix !== undefined ? String(input.pathPrefix) : undefined,
        action,
        since: input.since !== undefined ? String(input.since) : undefined,
      });
      const message =
        files.length === 0
          ? "No recent files recorded"
          : `Found ${files.length} recent file(s)`;
      return {
        ok: true,
        message,
        data: {
          message,
          files: files.map((f) => ({
            path: f.path,
            lastAction: f.lastAction,
            lastAccessedAt: f.lastAccessedAt,
            accessCount: f.accessCount,
          })),
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);

export const fileIndexSearch = defineTool(
  {
    name: "file.index.search",
    description:
      "Search the persistent file content index (FTS). Run atlas index build first.",
    version: "1.0.0",
    permissions: ["filesystem.read"],
    risk: "low",
    tags: ["filesystem", "mvp", "index", "search"],
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["message", "hits"],
      properties: {
        message: { type: "string" },
        hits: { type: "array" },
      },
    },
  },
  (input) => {
    try {
      const query = String(input.query ?? "");
      const hits = searchIndexedFiles({
        query,
        limit: typeof input.limit === "number" ? input.limit : undefined,
      });
      const message =
        hits.length === 0
          ? `No index hits for "${query}"`
          : `Found ${hits.length} index hit(s) for "${query}"`;
      return {
        ok: true,
        message,
        data: {
          message,
          hits: hits.map((h) => ({
            path: h.path,
            name: h.name,
            rank: h.rank,
            snippet: h.snippet,
          })),
        },
      };
    } catch (error) {
      return fail(error);
    }
  },
);
