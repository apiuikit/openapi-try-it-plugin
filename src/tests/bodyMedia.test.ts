import { describe, expect, it } from "vitest";
import type { OpenAPIRequestBodyData } from "apiuikit/plugin";
import { resolveRequestBodyMedia } from "../bodyMedia";
import type { Deref } from "../types";

const noopDeref: Deref = () => undefined;

describe("resolveRequestBodyMedia", () => {
  it("returns null when the request body declares no content", () => {
    expect(resolveRequestBodyMedia(undefined, noopDeref)).toBeNull();
    expect(resolveRequestBodyMedia({ content: {} } as OpenAPIRequestBodyData, noopDeref)).toBeNull();
  });

  it("prefers application/json when multiple content types are declared, mode text", () => {
    const requestBody: OpenAPIRequestBodyData = {
      content: {
        "text/plain": { schema: { type: "string" } },
        "application/json": { schema: { type: "object" }, example: { ok: true } },
      },
    };
    const media = resolveRequestBodyMedia(requestBody, noopDeref);
    expect(media?.contentType).toBe("application/json");
    expect(media?.mode).toBe("text");
    expect(media?.example).toEqual({ ok: true });
  });

  it("falls back to the first declared content type when there's no application/json", () => {
    const requestBody: OpenAPIRequestBodyData = { content: { "text/xml": { schema: { type: "string" } } } };
    expect(resolveRequestBodyMedia(requestBody, noopDeref)?.contentType).toBe("text/xml");
  });

  it("resolves a value example from `examples` when there's no top-level `example`", () => {
    const requestBody: OpenAPIRequestBodyData = {
      content: { "application/json": { examples: { sample: { value: { name: "Ada" } } } } },
    };
    expect(resolveRequestBodyMedia(requestBody, noopDeref)?.example).toEqual({ name: "Ada" });
  });

  it("classifies multipart/form-data as mode multipart and carries the schema through", () => {
    const requestBody: OpenAPIRequestBodyData = {
      content: {
        "multipart/form-data": {
          schema: { type: "object", properties: { file: { type: "string", format: "binary" } } },
        },
      },
    };
    const media = resolveRequestBodyMedia(requestBody, noopDeref);
    expect(media?.mode).toBe("multipart");
    expect(media?.schema).toEqual({ type: "object", properties: { file: { type: "string", format: "binary" } } });
  });

  it("classifies a `type: string, format: binary` schema as mode binary", () => {
    const requestBody: OpenAPIRequestBodyData = {
      content: { "image/png": { schema: { type: "string", format: "binary" } } },
    };
    expect(resolveRequestBodyMedia(requestBody, noopDeref)?.mode).toBe("binary");
  });

  it("classifies a nullable binary schema (type: [string, null]) as mode binary", () => {
    const requestBody: OpenAPIRequestBodyData = {
      content: { "image/png": { schema: { type: ["string", "null"], format: "binary" } as never } },
    };
    expect(resolveRequestBodyMedia(requestBody, noopDeref)?.mode).toBe("binary");
  });

  it("falls back to a content-type heuristic for binary when there's no schema at all", () => {
    const requestBody: OpenAPIRequestBodyData = { content: { "application/octet-stream": {} } };
    expect(resolveRequestBodyMedia(requestBody, noopDeref)?.mode).toBe("binary");
  });

  it("doesn't classify JSON as binary even without a schema", () => {
    const requestBody: OpenAPIRequestBodyData = { content: { "application/json": {} } };
    expect(resolveRequestBodyMedia(requestBody, noopDeref)?.mode).toBe("text");
  });

  it("resolves a circular-reference schema (unresolved $ref node) via deref", () => {
    const deref: Deref = (ref) => (ref === "#/components/schemas/Upload" ? { type: "string", format: "binary" } : undefined);
    const requestBody: OpenAPIRequestBodyData = {
      content: { "application/pdf": { schema: { $ref: "#/components/schemas/Upload" } as never } },
    };
    expect(resolveRequestBodyMedia(requestBody, deref)?.mode).toBe("binary");
  });
});
