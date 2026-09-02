import { resolveSchemaObject } from "./schemaRef";
import type { Deref, EditableBodyFieldRow } from "./types";

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `body-field-${nextId}`;
}

/** `type` is usually the plain string `"string"`, but a nullable binary
 * field (e.g. an optional thumbnail upload) commonly shows up as OpenAPI
 * 3.1/JSON Schema 2020-12's `type: ["string", "null"]` instead of the
 * 3.0-style `nullable: true` flag — either way it's still a file field. */
function isFileSchema(schema: Record<string, unknown> | undefined): boolean {
  if (schema?.format !== "binary") return false;
  const type = schema.type;
  return type === "string" || (Array.isArray(type) && type.includes("string"));
}

function isArrayOfFilesSchema(schema: Record<string, unknown> | undefined, deref: Deref): boolean {
  if (schema?.type !== "array") return false;
  return isFileSchema(resolveSchemaObject(schema.items, deref));
}

function exampleText(schema: Record<string, unknown> | undefined): string {
  if (schema?.example !== undefined) return String(schema.example);
  if (schema?.default !== undefined) return String(schema.default);
  return "";
}

/** Builds one editable row per property of a `multipart/form-data` body's
 * object schema — a text input for an ordinary property, a file picker for
 * one declared `type: string, format: binary` (or `type: array` of those,
 * for repeated files under the same field name). Rows for a property with
 * no declared `type: object`/`properties` schema at all (e.g. the whole
 * body is just `{}`) come back empty, same as an operation with no body. */
export function buildMultipartFieldRows(schema: Record<string, unknown> | undefined, deref: Deref): EditableBodyFieldRow[] {
  const properties = schema?.properties;
  if (!properties || typeof properties !== "object") return [];

  const required = new Set(Array.isArray(schema?.required) ? (schema.required as unknown[]).map(String) : []);

  return Object.entries(properties as Record<string, unknown>).map(([key, rawPropertySchema]) => {
    const propertySchema = resolveSchemaObject(rawPropertySchema, deref);
    const isFile = isFileSchema(propertySchema) || isArrayOfFilesSchema(propertySchema, deref);
    const isRequired = required.has(key);
    const value = isFile ? "" : exampleText(propertySchema);
    return {
      id: makeId(),
      key,
      isFile,
      value,
      enabled: isRequired || value !== "",
      fromSpec: true,
      required: isRequired,
      description: typeof propertySchema?.description === "string" ? propertySchema.description : undefined,
    } satisfies EditableBodyFieldRow;
  });
}

export function newBlankBodyFieldRow(): EditableBodyFieldRow {
  return { id: makeId(), key: "", isFile: false, value: "", enabled: true, fromSpec: false };
}
