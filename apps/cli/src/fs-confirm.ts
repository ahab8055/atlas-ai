/**
 * TTY confirmation host for FileAccessService permission blocks (ADR-0083).
 */
import { readSync } from "node:fs";

import {
  configureFsConfirmHost,
  type FsConfirmRequest,
} from "@atlas-ai/filesystem";
import type { PermissionManager } from "@atlas-ai/security";

function readLineFromStdin(): string {
  let line = "";
  const buf = Buffer.alloc(1);
  while (true) {
    const n = readSync(0, buf, 0, 1, null);
    if (n <= 0) {
      break;
    }
    const ch = buf.toString("utf8");
    if (ch === "\n") {
      break;
    }
    if (ch !== "\r") {
      line += ch;
    }
  }
  return line.trim();
}

export function promptFsConfirm(request: FsConfirmRequest): boolean {
  if (!process.stdin.isTTY) {
    return false;
  }
  const target = request.resource ? ` on ${request.resource}` : "";
  const kind = request.destructive ? "destructive" : "privileged";
  process.stderr.write(
    `[atlas] Confirm ${kind} ${request.capability}${target}?\n` +
      `  ${request.message}\n` +
      `  Proceed? [y/N] `,
  );
  const answer = readLineFromStdin();
  return /^y(es)?$/i.test(answer);
}

/** Wire PermissionManager + TTY prompt into file tool confirm retries. */
export function installCliFsConfirmHost(permissions: PermissionManager): void {
  configureFsConfirmHost({
    permissions,
    confirm: promptFsConfirm,
  });
}
