export type KnowledgeErrorCode =
  "not_found" | "invalid_input" | "missing_endpoint" | "conflict";

export class KnowledgeError extends Error {
  readonly code: KnowledgeErrorCode;

  constructor(code: KnowledgeErrorCode, message: string) {
    super(message);
    this.name = "KnowledgeError";
    this.code = code;
  }
}
