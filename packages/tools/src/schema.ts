import type { ToolJsonSchema } from "./types.js";

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Minimal required-field / type check for tool inputs.
 * Not a full JSON Schema engine — enough for MVP consistency.
 */
export function validateAgainstSchema(
  value: unknown,
  schema: ToolJsonSchema,
  path = "$",
): SchemaValidationResult {
  const errors: string[] = [];

  if (schema.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${path}: expected object`);
      return { valid: false, errors };
    }
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (record[key] === undefined) {
        errors.push(`${path}.${key}: required`);
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (record[key] === undefined) {
          continue;
        }
        const nested = validateAgainstSchema(
          record[key],
          propSchema,
          `${path}.${key}`,
        );
        errors.push(...nested.errors);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${path}: expected ${schema.type}`);
  }

  return { valid: errors.length === 0, errors };
}

function matchesType(value: unknown, type: ToolJsonSchema["type"]): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && !Number.isNaN(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null;
    case "object":
      return (
        value !== null && typeof value === "object" && !Array.isArray(value)
      );
    default:
      return true;
  }
}
