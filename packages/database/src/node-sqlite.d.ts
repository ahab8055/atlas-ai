/**
 * Minimal typings for experimental `node:sqlite` (Node 22+).
 * @types/node may lag the runtime API.
 */
declare module "node:sqlite" {
  export interface StatementResultingChanges {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    run(...params: unknown[]): StatementResultingChanges;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  }

  export class DatabaseSync {
    constructor(
      path: string,
      options?: {
        open?: boolean;
        readOnly?: boolean;
        enableForeignKeys?: boolean;
      },
    );
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
    open(): void;
  }
}
