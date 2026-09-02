import { describe, expect, it } from "vitest";
import { buildMultipartFieldRows } from "../bodyFields";
import type { Deref } from "../types";

const noopDeref: Deref = () => undefined;

describe("buildMultipartFieldRows", () => {
  it("returns no rows for a schema with no object properties", () => {
    expect(buildMultipartFieldRows(undefined, noopDeref)).toEqual([]);
    expect(buildMultipartFieldRows({ type: "string" }, noopDeref)).toEqual([]);
  });

  it("builds a text row for an ordinary property, seeded from its example/default", () => {
    const schema = {
      type: "object",
      properties: {
        title: { type: "string", example: "My title" },
        note: { type: "string", default: "n/a" },
        blank: { type: "string" },
      },
    };
    const rows = buildMultipartFieldRows(schema, noopDeref);
    expect(rows).toHaveLength(3);

    const title = rows.find((r) => r.key === "title")!;
    expect(title.isFile).toBe(false);
    expect(title.value).toBe("My title");
    expect(title.enabled).toBe(true); // has a value, so pre-enabled

    const note = rows.find((r) => r.key === "note")!;
    expect(note.value).toBe("n/a");

    const blank = rows.find((r) => r.key === "blank")!;
    expect(blank.value).toBe("");
    expect(blank.enabled).toBe(false); // no value, not required
  });

  it("builds a file row for a type: string, format: binary property", () => {
    const schema = { type: "object", properties: { avatar: { type: "string", format: "binary" } } };
    const rows = buildMultipartFieldRows(schema, noopDeref);
    expect(rows[0]?.isFile).toBe(true);
    expect(rows[0]?.value).toBe("");
  });

  it("builds a file row for an array of format: binary items", () => {
    const schema = {
      type: "object",
      properties: { attachments: { type: "array", items: { type: "string", format: "binary" } } },
    };
    const rows = buildMultipartFieldRows(schema, noopDeref);
    expect(rows[0]?.isFile).toBe(true);
  });

  it("treats a nullable binary property (type: [string, null]) as a file field", () => {
    const schema = { type: "object", properties: { thumbnail: { type: ["string", "null"], format: "binary" } } };
    const rows = buildMultipartFieldRows(schema, noopDeref);
    expect(rows[0]?.isFile).toBe(true);
  });

  it("does not treat a plain string array as a file field", () => {
    const schema = { type: "object", properties: { tags: { type: "array", items: { type: "string" } } } };
    const rows = buildMultipartFieldRows(schema, noopDeref);
    expect(rows[0]?.isFile).toBe(false);
  });

  it("marks required properties as required and pre-enabled even with no value", () => {
    const schema = { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } };
    const rows = buildMultipartFieldRows(schema, noopDeref);
    expect(rows[0]?.required).toBe(true);
    expect(rows[0]?.enabled).toBe(true);
  });

  it("carries a property's description through", () => {
    const schema = { type: "object", properties: { note: { type: "string", description: "Free-text note" } } };
    const rows = buildMultipartFieldRows(schema, noopDeref);
    expect(rows[0]?.description).toBe("Free-text note");
  });

  it("resolves a property schema that's an unresolved $ref node via deref", () => {
    const deref: Deref = (ref) => (ref === "#/components/schemas/File" ? { type: "string", format: "binary" } : undefined);
    const schema = { type: "object", properties: { upload: { $ref: "#/components/schemas/File" } } };
    const rows = buildMultipartFieldRows(schema, deref);
    expect(rows[0]?.isFile).toBe(true);
  });

  it("gives every row a unique id", () => {
    const schema = { type: "object", properties: { a: { type: "string" }, b: { type: "string" } } };
    const rows = buildMultipartFieldRows(schema, noopDeref);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });
});
