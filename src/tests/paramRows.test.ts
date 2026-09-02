import { describe, expect, it } from "vitest";
import type { OpenAPIDocumentData } from "apiuikit/plugin";
import { buildRowsFromParameters, resolveOperationParameters } from "../paramRows";
import type { Deref } from "../types";

const noopDeref: Deref = () => undefined;

describe("resolveOperationParameters", () => {
  it("merges path-item-level params with operation-level params, operation wins on conflict", () => {
    const document: OpenAPIDocumentData = {
      openapi: "3.1.0",
      info: { title: "t", version: "1" },
      paths: {
        "/users/{userId}": {
          parameters: [{ name: "userId", in: "path", required: true, description: "path-level" }],
          get: {
            parameters: [
              { name: "userId", in: "path", required: true, description: "operation-level" },
              { name: "verbose", in: "query" },
            ],
          },
        },
      },
    };

    const resolved = resolveOperationParameters(document, "get", "/users/{userId}");
    expect(resolved).toHaveLength(2);
    expect(resolved.find((p) => p.name === "userId")?.description).toBe("operation-level");
    expect(resolved.find((p) => p.name === "verbose")).toBeDefined();
  });
});

describe("buildRowsFromParameters", () => {
  it("expands a deepObject query param into a sub-table seeded from schema.properties", () => {
    const rows = buildRowsFromParameters(
      [
        {
          name: "filters",
          in: "query",
          style: "deepObject",
          schema: { type: "object", properties: { active: { type: "boolean" }, minAge: { type: "integer" } } },
        } as never,
      ],
      "query",
      noopDeref,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deepObject).toBe(true);
    expect(rows[0]?.deepObjectEntries?.map((e) => e.key)).toEqual(["active", "minAge"]);
  });

  it("seeds a simple param's value from its declared example", () => {
    const rows = buildRowsFromParameters([{ name: "id", in: "path", required: true, example: "usr_123" }], "path", noopDeref);
    expect(rows[0]?.value).toBe("usr_123");
    expect(rows[0]?.enabled).toBe(true);
  });

  it("expands a type:array query param into array values, defaulting to style form/explode true", () => {
    const rows = buildRowsFromParameters([{ name: "tags", in: "query", schema: { type: "array" } } as never], "query", noopDeref);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.isArray).toBe(true);
    expect(rows[0]?.arrayStyle).toBe("form");
    expect(rows[0]?.arrayExplode).toBe(true);
    expect(rows[0]?.arrayValues).toHaveLength(1);
    expect(rows[0]?.arrayValues?.[0]?.value).toBe("");
  });

  it("seeds array values from a declared example array", () => {
    const rows = buildRowsFromParameters(
      [{ name: "tags", in: "query", example: ["red", "blue"], schema: { type: "array" } } as never],
      "query",
      noopDeref,
    );
    expect(rows[0]?.arrayValues?.map((v) => v.value)).toEqual(["red", "blue"]);
    expect(rows[0]?.enabled).toBe(true);
  });

  it("reads explicit style/explode instead of the form default", () => {
    const rows = buildRowsFromParameters(
      [{ name: "tags", in: "query", style: "pipeDelimited", explode: false, schema: { type: "array" } } as never],
      "query",
      noopDeref,
    );
    expect(rows[0]?.arrayStyle).toBe("pipeDelimited");
    expect(rows[0]?.arrayExplode).toBe(false);
  });

  describe("circular $ref schemas", () => {
    // apiuikit leaves a *circular* schema reference as an unresolved
    // `{ $ref }` node rather than inlining it (see Deref's doc comment) —
    // these simulate that shape and a `deref` that resolves it, the way
    // `useDocumentContext().deref` would against the real document.
    const deepObjectSchema = { type: "object", properties: { active: { type: "boolean" }, role: { type: "string" } } };
    const arraySchema = { type: "array", example: ["a", "b"] };
    const fakeDeref: Deref = (ref) => {
      if (ref === "#/components/schemas/Filters") return deepObjectSchema;
      if (ref === "#/components/schemas/Tags") return arraySchema;
      return undefined;
    };

    it("resolves a deepObject param whose schema is an unresolved $ref via deref", () => {
      const rows = buildRowsFromParameters(
        [{ name: "filters", in: "query", style: "deepObject", schema: { $ref: "#/components/schemas/Filters" } } as never],
        "query",
        fakeDeref,
      );
      expect(rows[0]?.deepObject).toBe(true);
      expect(rows[0]?.deepObjectEntries?.map((e) => e.key)).toEqual(["active", "role"]);
    });

    it("resolves an array param whose schema is an unresolved $ref via deref", () => {
      const rows = buildRowsFromParameters(
        [{ name: "tags", in: "query", schema: { $ref: "#/components/schemas/Tags" } } as never],
        "query",
        fakeDeref,
      );
      expect(rows[0]?.isArray).toBe(true);
      expect(rows[0]?.arrayValues?.map((v) => v.value)).toEqual(["a", "b"]);
    });

    it("falls back to an empty sub-table (not a throw) when deref can't resolve the $ref", () => {
      const rows = buildRowsFromParameters(
        [{ name: "filters", in: "query", style: "deepObject", schema: { $ref: "#/components/schemas/Missing" } } as never],
        "query",
        fakeDeref,
      );
      expect(rows[0]?.deepObject).toBe(true);
      expect(rows[0]?.deepObjectEntries).toEqual([]);
    });
  });
});
