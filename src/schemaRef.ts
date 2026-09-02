import type { Deref } from "./types";

/** A schema is usually already the real object — apiuikit resolves ordinary
 * `$ref`s before handing a plugin its document. The one case that stays an
 * unresolved `{ $ref }` node is a *circular* schema reference (apiuikit's
 * own back-edge convention, see `useDocumentContext().deref`'s doc comment
 * in `apiuikit/plugin`); this resolves that one level via `deref` rather
 * than silently reading `undefined` off the `{ $ref }` node's non-existent
 * fields. Shared by `paramRows.ts` (parameter schemas) and `bodyFields.ts`
 * (multipart property schemas) — both hit the same circular-ref case. */
export function resolveSchemaObject(schema: unknown, deref: Deref): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== "object") return undefined;
  if ("$ref" in schema && typeof (schema as { $ref: unknown }).$ref === "string") {
    const resolved = deref((schema as { $ref: string }).$ref);
    return resolved && typeof resolved === "object" ? (resolved as Record<string, unknown>) : undefined;
  }
  return schema as Record<string, unknown>;
}
