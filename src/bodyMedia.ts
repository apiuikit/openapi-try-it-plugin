import type { OpenAPIRequestBodyData } from "apiuikit/plugin";
import { resolveSchemaObject } from "./schemaRef";
import type { BodyMode, Deref } from "./types";

export interface ResolvedBodyMedia {
  contentType: string;
  mode: BodyMode;
  example?: unknown;
  /** `mode: "multipart"` only — the content type's object schema (`$ref`s
   * resolved one level via `deref`), for `bodyFields.ts` to build rows
   * from. */
  schema?: Record<string, unknown>;
}

/** Content types this plugin treats as a single-file body even when the
 * schema doesn't spell out `format: binary` (or there's no schema at all —
 * a bare `content: { application/octet-stream: {} }` is common). Doesn't
 * cover every binary type in existence; a spec that declares
 * `format: binary` explicitly is caught regardless of content type. */
const HEURISTIC_BINARY_CONTENT_TYPE = /^(application\/octet-stream|application\/pdf|application\/zip)\b|^(image|audio|video)\//i;

/** `type` is usually the plain string `"string"`, but a nullable binary body
 * commonly shows up as OpenAPI 3.1/JSON Schema 2020-12's
 * `type: ["string", "null"]` instead of the 3.0-style `nullable: true`
 * flag — either way it's still a binary body. */
function isBinarySchema(schema: Record<string, unknown> | undefined): boolean {
  if (schema?.format !== "binary") return false;
  const type = schema.type;
  return type === "string" || (Array.isArray(type) && type.includes("string"));
}

function resolveBodyMode(contentType: string, schema: Record<string, unknown> | undefined): BodyMode {
  if (contentType.toLowerCase() === "multipart/form-data") return "multipart";
  if (isBinarySchema(schema)) return "binary";
  if (!schema && HEURISTIC_BINARY_CONTENT_TYPE.test(contentType)) return "binary";
  return "text";
}

/** Picks which declared request-body content type to prefill: prefers
 * `application/json`, else the first declared type, and surfaces its
 * author-supplied `example`/`examples` value as starting text — plus, new
 * here, which body editor that content type calls for (see `BodyMode`). */
export function resolveRequestBodyMedia(requestBody: OpenAPIRequestBodyData | undefined, deref: Deref): ResolvedBodyMedia | null {
  const content = requestBody?.content;
  if (!content) return null;

  const contentType = "application/json" in content ? "application/json" : Object.keys(content)[0];
  if (!contentType) return null;

  const media = content[contentType];
  if (!media) return null;

  let example = media.example;
  if (example === undefined && media.examples) {
    for (const candidate of Object.values(media.examples)) {
      if (candidate && typeof candidate === "object" && "value" in candidate && candidate.value !== undefined) {
        example = candidate.value;
        break;
      }
    }
  }

  const schema = resolveSchemaObject(media.schema, deref);
  const mode = resolveBodyMode(contentType, schema);
  return { contentType, mode, example, schema: mode === "multipart" ? schema : undefined };
}
