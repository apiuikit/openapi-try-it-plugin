import { describe, expect, it } from "vitest";
import {
  buildExport,
  exportAsHar,
  exportAsInsomnia,
  exportAsPostmanCollection,
  filenameForExport,
  queryPairsFromUrl,
} from "../exportRequest";
import { buildRequest, type BuildRequestInput } from "../requestBuilder";
import type { BuiltRequest, EditableParamRow, FetchOutcome } from "../types";

function row(overrides: Partial<EditableParamRow>): EditableParamRow {
  return { id: "id", in: "query", name: "name", value: "", enabled: true, fromSpec: false, ...overrides };
}

const exportedAt = new Date("2026-09-05T10:00:00.000Z");
const insomniaIds = { workspace: "wrk_test", request: "req_test" };

/** Minimal GET with nothing filled in — redaction cases add only the one
 * field under test, so a leak can't hide behind unrelated fixture data. */
const emptyRequest: BuildRequestInput = {
  method: "get",
  baseUrl: "https://api.example.com",
  path: "/things",
  pathParams: [],
  queryParams: [],
  headerParams: [],
  cookieParams: [],
  credentials: {},
  security: null,
  bodyText: "",
};

function jsonPost(): BuiltRequest {
  return buildRequest({
    method: "post",
    baseUrl: "https://api.example.com",
    path: "/users/{userId}",
    pathParams: [row({ in: "path", name: "userId", value: "usr 1" })],
    queryParams: [
      row({ name: "active", value: "true" }),
      row({ name: "skipped", value: "x", enabled: false }),
    ],
    headerParams: [row({ in: "header", name: "X-Request-Id", value: "abc" })],
    cookieParams: [row({ in: "cookie", name: "session", value: "s3cret" })],
    security: [{ schemeName: "bearer", scheme: { type: "http", scheme: "bearer" }, scopes: [] }],
    credentials: { bearer: { kind: "bearer", token: "tok_123" } },
    bodyText: '{"name":"Ada"}',
    bodyContentType: "application/json",
  });
}

describe("queryPairsFromUrl", () => {
  it("reads pairs from an absolute URL, including repeated keys", () => {
    expect(queryPairsFromUrl("https://api.example.com/search?id=3&id=4&q=a+b")).toEqual([
      { name: "id", value: "3" },
      { name: "id", value: "4" },
      { name: "q", value: "a b" },
    ]);
  });

  it("still reads the query string when the URL isn't absolute", () => {
    expect(queryPairsFromUrl("/v1/users?active=true")).toEqual([{ name: "active", value: "true" }]);
  });

  it("strips a hash fragment before parsing a relative URL's query string", () => {
    expect(queryPairsFromUrl("/v1/users?active=true#section")).toEqual([{ name: "active", value: "true" }]);
  });
});

describe("filenameForExport", () => {
  it("slugs the method and path into a client-specific filename", () => {
    expect(filenameForExport("postman", "post", "/users/{userId}")).toBe("post-users-userid.postman_collection.json");
    expect(filenameForExport("insomnia", "get", "/search")).toBe("get-search.insomnia.json");
    expect(filenameForExport("har", "put", "/files/avatar")).toBe("put-files-avatar.har");
  });
});

describe("exportAsPostmanCollection", () => {
  it("builds a v2.1 collection with a structured URL, headers, and raw JSON body", () => {
    const collection = exportAsPostmanCollection({ request: jsonPost(), name: "Create user", exportedAt });
    expect(collection).toEqual({
      info: {
        name: "Create user",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: [
        {
          name: "Create user",
          request: {
            method: "POST",
            header: [
              { key: "X-Request-Id", value: "abc" },
              { key: "Authorization", value: "{{Authorization}}" },
              { key: "Cookie", value: "{{Cookie}}" },
              { key: "Content-Type", value: "application/json" },
            ],
            url: {
              raw: "https://api.example.com/users/usr%201?active=true",
              protocol: "https",
              host: ["api", "example", "com"],
              path: ["users", "usr%201"],
              query: [{ key: "active", value: "true" }],
            },
            body: {
              mode: "raw",
              raw: '{"name":"Ada"}',
              options: { raw: { language: "json" } },
            },
          },
        },
      ],
      // Declared up front so Postman shows the redacted credentials as
      // blanks to fill in, rather than as unresolved template text.
      variable: [
        { key: "Authorization", value: "", type: "string" },
        { key: "Cookie", value: "", type: "string" },
      ],
    });
  });

  it("omits body on a GET and exports multipart fields as formdata (files as src filenames)", () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const get = buildRequest({
      method: "get",
      baseUrl: "https://api.example.com",
      path: "/users",
      pathParams: [],
      queryParams: [],
      headerParams: [],
      cookieParams: [],
      security: null,
      credentials: {},
      bodyText: "",
    });
    const getCollection = exportAsPostmanCollection({ request: get, name: "List" });
    expect((getCollection.item as Array<{ request: { body?: unknown } }>)[0]?.request.body).toBeUndefined();

    const multipart = buildRequest({
      method: "post",
      baseUrl: "https://api.example.com",
      path: "/upload",
      pathParams: [],
      queryParams: [],
      headerParams: [],
      cookieParams: [],
      security: null,
      credentials: {},
      bodyMode: "multipart",
      bodyText: "",
      multipartFields: [
        { id: "1", key: "title", isFile: false, value: "My title", enabled: true, fromSpec: true },
        { id: "2", key: "avatar", isFile: true, value: "", files: [file], enabled: true, fromSpec: true },
      ],
    });
    const multipartCollection = exportAsPostmanCollection({ request: multipart, name: "Upload" });
    expect((multipartCollection.item as Array<{ request: { body: unknown } }>)[0]?.request.body).toEqual({
      mode: "formdata",
      formdata: [
        { key: "title", type: "text", value: "My title" },
        { key: "avatar", type: "file", src: "hello.txt" },
      ],
    });
  });
});

describe("exportAsInsomnia", () => {
  it("builds a v4 export with a workspace + request, using injected ids", () => {
    const exported = exportAsInsomnia({
      request: jsonPost(),
      name: "Create user",
      exportedAt,
      insomniaIds,
    });

    expect(exported._type).toBe("export");
    expect(exported.__export_format).toBe(4);
    expect(exported.__export_date).toBe("2026-09-05T10:00:00.000Z");
    expect(exported.__export_source).toBe("@apiuikit/openapi-try-it-plugin");

    const resources = exported.resources as Array<Record<string, unknown>>;
    expect(resources).toHaveLength(2);
    expect(resources[0]).toMatchObject({
      _id: "wrk_test",
      parentId: null,
      name: "Create user",
      scope: "collection",
      _type: "workspace",
    });
    expect(resources[1]).toMatchObject({
      _id: "req_test",
      parentId: "wrk_test",
      url: "https://api.example.com/users/usr%201?active=true",
      method: "POST",
      name: "Create user",
      _type: "request",
      body: { mimeType: "application/json", text: '{"name":"Ada"}' },
      headers: [
        { name: "X-Request-Id", value: "abc" },
        { name: "Authorization", value: "{{Authorization}}" },
        { name: "Cookie", value: "{{Cookie}}" },
        { name: "Content-Type", value: "application/json" },
      ],
    });
  });

  it("exports a binary body as a filename, not the file bytes", () => {
    const file = new File(["binary-data"], "photo.png", { type: "image/png" });
    const request = buildRequest({
      method: "put",
      baseUrl: "https://api.example.com",
      path: "/avatar",
      pathParams: [],
      queryParams: [],
      headerParams: [],
      cookieParams: [],
      security: null,
      credentials: {},
      bodyMode: "binary",
      bodyText: "",
      bodyContentType: "image/png",
      binaryFile: file,
    });
    const exported = exportAsInsomnia({ request, name: "Avatar", exportedAt, insomniaIds });
    const resources = exported.resources as Array<Record<string, unknown>>;
    expect(resources[1]?.body).toEqual({ mimeType: "image/png", fileName: "photo.png" });
  });
});

describe("exportAsHar", () => {
  it("builds a HAR 1.2 log with queryString, cookies, and postData", () => {
    const har = exportAsHar({ request: jsonPost(), name: "Create user", exportedAt });
    expect(har).toEqual({
      log: {
        version: "1.2",
        creator: { name: "@apiuikit/openapi-try-it-plugin", version: "0.1.0" },
        entries: [
          {
            startedDateTime: "2026-09-05T10:00:00.000Z",
            time: 0,
            request: {
              method: "POST",
              url: "https://api.example.com/users/usr%201?active=true",
              httpVersion: "HTTP/1.1",
              // Redacted along with the Cookie header it mirrors.
          cookies: [],
              headers: [
                { name: "X-Request-Id", value: "abc" },
                { name: "Authorization", value: "{{Authorization}}" },
                { name: "Cookie", value: "{{Cookie}}" },
                { name: "Content-Type", value: "application/json" },
              ],
              queryString: [{ name: "active", value: "true" }],
              headersSize: -1,
              bodySize: 14,
              postData: { mimeType: "application/json", text: '{"name":"Ada"}' },
            },
            response: {
              status: 0,
              statusText: "",
              httpVersion: "HTTP/1.1",
              cookies: [],
              headers: [],
              content: { size: 0, mimeType: "application/octet-stream" },
              redirectURL: "",
              headersSize: -1,
              bodySize: -1,
            },
            cache: {},
            timings: { send: 0, wait: 0, receive: 0 },
          },
        ],
      },
    });
  });

  it("counts HAR bodySize and content.size in UTF-8 bytes, not JS string length", () => {
    const bodyText = '{"name":"café"}';
    const utf8Length = new TextEncoder().encode(bodyText).byteLength;
    expect(utf8Length).toBeGreaterThan(bodyText.length);

    const request = buildRequest({
      method: "post",
      baseUrl: "https://api.example.com",
      path: "/users",
      pathParams: [],
      queryParams: [],
      headerParams: [],
      cookieParams: [],
      security: null,
      credentials: {},
      bodyText,
      bodyContentType: "application/json",
    });
    const outcome: FetchOutcome = {
      kind: "success",
      result: {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: [["content-type", "application/json"]],
        body: bodyText,
        durationMs: 1,
      },
    };
    const har = exportAsHar({ request, name: "Create user", exportedAt, outcome });
    const entry = (har.log as { entries: Array<{ request: { bodySize: number }; response: { bodySize: number; content: { size: number } } }> }).entries[0]!;
    expect(entry.request.bodySize).toBe(utf8Length);
    expect(entry.response.bodySize).toBe(utf8Length);
    expect(entry.response.content.size).toBe(utf8Length);
  });

  it("attaches the last successful response when one is supplied", () => {
    const outcome: FetchOutcome = {
      kind: "success",
      result: {
        ok: true,
        status: 201,
        statusText: "Created",
        headers: [["content-type", "application/json"]],
        body: '{"id":1}',
        durationMs: 42,
      },
    };
    const har = exportAsHar({ request: jsonPost(), name: "Create user", exportedAt, outcome });
    const entry = (har.log as { entries: Array<Record<string, unknown>> }).entries[0]!;
    expect(entry.time).toBe(42);
    expect(entry.timings).toEqual({ send: 0, wait: 42, receive: 0 });
    expect(entry.response).toEqual({
      status: 201,
      statusText: "Created",
      httpVersion: "HTTP/1.1",
      cookies: [],
      headers: [{ name: "content-type", value: "application/json" }],
      content: { size: 8, mimeType: "application/json", text: '{"id":1}' },
      redirectURL: "",
      headersSize: -1,
      bodySize: 8,
    });
  });

  it("exports multipart as HAR params with filenames, not file bytes", () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const request = buildRequest({
      method: "post",
      baseUrl: "https://api.example.com",
      path: "/upload",
      pathParams: [],
      queryParams: [],
      headerParams: [],
      cookieParams: [],
      security: null,
      credentials: {},
      bodyMode: "multipart",
      bodyText: "",
      multipartFields: [
        { id: "1", key: "title", isFile: false, value: "My title", enabled: true, fromSpec: true },
        { id: "2", key: "avatar", isFile: true, value: "", files: [file], enabled: true, fromSpec: true },
      ],
    });
    const har = exportAsHar({ request, name: "Upload", exportedAt });
    const entry = (har.log as { entries: Array<{ request: { postData: unknown; bodySize: number } }> }).entries[0]!;
    expect(entry.request.bodySize).toBe(-1);
    expect(entry.request.postData).toEqual({
      mimeType: "multipart/form-data",
      params: [
        { name: "title", value: "My title" },
        { name: "avatar", fileName: "hello.txt", contentType: "text/plain" },
      ],
    });
  });
});

describe("buildExport", () => {
  it("dispatches to the matching format", () => {
    const request = jsonPost();
    const input = { request, name: "Create user", exportedAt, insomniaIds };
    expect(buildExport("postman", input).info).toBeDefined();
    expect(buildExport("insomnia", input).__export_format).toBe(4);
    expect((buildExport("har", input).log as { version: string }).version).toBe("1.2");
  });
});

describe("credential redaction", () => {
  /** Every format, checked by scanning the serialized file rather than by
   * asserting a shape — a credential leaking through a field the assertions
   * above don't name is exactly the failure this guards against. */
  function exportsOf(request: BuiltRequest): string[] {
    return (["postman", "insomnia", "har"] as const).map((format) =>
      JSON.stringify(buildExport(format, { request, name: "Export", exportedAt })),
    );
  }

  it("keeps an apiKey header out of every export", () => {
    const request = buildRequest({
      ...emptyRequest,
      security: [
        { schemeName: "key", scheme: { type: "apiKey", in: "header", name: "X-API-Key" }, scopes: [] },
      ],
      credentials: { key: { kind: "apiKey", value: "sk_live_secret" } },
    });

    for (const exported of exportsOf(request)) {
      expect(exported).not.toContain("sk_live_secret");
      expect(exported).toContain("{{X-API-Key}}");
    }
  });

  it("keeps an apiKey query parameter out of every export, URL included", () => {
    const request = buildRequest({
      ...emptyRequest,
      security: [
        { schemeName: "key", scheme: { type: "apiKey", in: "query", name: "api_key" }, scopes: [] },
      ],
      credentials: { key: { kind: "apiKey", value: "sk_live_secret" } },
    });

    expect(request.url).toContain("sk_live_secret"); // the live request still carries it
    for (const exported of exportsOf(request)) {
      expect(exported).not.toContain("sk_live_secret");
      expect(exported).toContain("{{api_key}}");
    }
  });

  it("keeps basic-auth credentials out of every export", () => {
    const request = buildRequest({
      ...emptyRequest,
      security: [{ schemeName: "basic", scheme: { type: "http", scheme: "basic" }, scopes: [] }],
      credentials: { basic: { kind: "basic", username: "ada", password: "hunter2" } },
    });

    const encoded = btoa("ada:hunter2");
    for (const exported of exportsOf(request)) {
      expect(exported).not.toContain(encoded);
      expect(exported).not.toContain("hunter2");
    }
  });

  it("redacts a token typed straight into the headers table, with no scheme involved", () => {
    const request = buildRequest({
      ...emptyRequest,
      headerParams: [row({ in: "header", name: "Authorization", value: "Bearer typed_by_hand" })],
    });

    for (const exported of exportsOf(request)) {
      expect(exported).not.toContain("typed_by_hand");
    }
  });

  it("leaves non-credential headers and params alone", () => {
    const request = buildRequest({
      ...emptyRequest,
      headerParams: [row({ in: "header", name: "X-Request-Id", value: "abc123" })],
      queryParams: [row({ name: "active", value: "true" })],
    });

    for (const exported of exportsOf(request)) {
      expect(exported).toContain("abc123");
      expect(exported).toContain("active");
    }
  });
});
