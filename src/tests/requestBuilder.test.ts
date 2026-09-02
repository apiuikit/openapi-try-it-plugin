import { describe, expect, it } from "vitest";
import type { OpenAPIDocumentData, OpenAPISecuritySchemeData, OpenAPIServerData } from "apiuikit/plugin";
import {
  applyQueryParams,
  applySecurity,
  buildRequest,
  buildRequestPath,
  defaultServerVariableValues,
  isOAuth2TokenExpired,
  resolveSecurityRequirements,
  resolveServerUrl,
  resolveServerVariableValues,
} from "../requestBuilder";
import type { EditableParamRow } from "../types";

function row(overrides: Partial<EditableParamRow>): EditableParamRow {
  return { id: "id", in: "query", name: "name", value: "", enabled: true, fromSpec: false, ...overrides };
}

describe("resolveServerUrl", () => {
  it("falls back to localhost when no server is declared", () => {
    expect(resolveServerUrl(undefined, {})).toBe("http://localhost");
  });

  it("substitutes variables with user overrides, falling back to declared defaults", () => {
    const server: OpenAPIServerData = {
      url: "https://{region}.api.example.com/{version}",
      variables: { region: { default: "us-east-1" }, version: { default: "v1" } },
    };
    expect(resolveServerUrl(server, {})).toBe("https://us-east-1.api.example.com/v1");
    expect(resolveServerUrl(server, { region: "eu-west-1" })).toBe("https://eu-west-1.api.example.com/v1");
  });

  it("falls back to the enum's first value, then the literal token, when there is no default", () => {
    const server: OpenAPIServerData = {
      url: "https://{env}.example.com/{missing}",
      variables: { env: { enum: ["staging", "prod"] } as never },
    };
    expect(resolveServerUrl(server, {})).toBe("https://staging.example.com/{missing}");
  });
});

describe("defaultServerVariableValues", () => {
  it("seeds one entry per declared variable", () => {
    const server: OpenAPIServerData = { url: "https://{region}.example.com", variables: { region: { default: "us" } } };
    expect(defaultServerVariableValues(server)).toEqual({ region: "us" });
  });
});

describe("resolveServerVariableValues", () => {
  it("overlays persisted values only for variables declared on the selected server", () => {
    const server: OpenAPIServerData = {
      url: "https://{region}.example.com/{version}",
      variables: { region: { default: "us-east-1" }, version: { default: "v1" } },
    };
    expect(resolveServerVariableValues(server, { region: "eu-west-1", stale: "ignored" })).toEqual({
      region: "eu-west-1",
      version: "v1",
    });
  });
});

describe("buildRequestPath", () => {
  it("substitutes enabled path params and percent-encodes their values", () => {
    const params = [row({ in: "path", name: "userId", value: "usr abc" })];
    expect(buildRequestPath("/users/{userId}", params)).toBe("/users/usr%20abc");
  });

  it("leaves an unresolved token in place rather than encoding it", () => {
    expect(buildRequestPath("/users/{userId}", [])).toBe("/users/{userId}");
  });
});

describe("applyQueryParams", () => {
  it("appends enabled simple params and skips disabled/empty ones", () => {
    const params = [
      row({ name: "active", value: "true", enabled: true }),
      row({ name: "skipped", value: "x", enabled: false }),
      row({ name: "empty", value: "", enabled: true }),
    ];
    const url = applyQueryParams("https://api.example.com/users", params);
    expect(new URL(url).searchParams.get("active")).toBe("true");
    expect(new URL(url).searchParams.has("skipped")).toBe(false);
    expect(new URL(url).searchParams.has("empty")).toBe(false);
  });

  it("serializes deepObject params as bracketed keys", () => {
    const params = [
      row({
        name: "filters",
        deepObject: true,
        deepObjectEntries: [
          { id: "a", key: "active", value: "true", enabled: true },
          { id: "b", key: "minAge", value: "18", enabled: true },
          { id: "c", key: "skipped", value: "x", enabled: false },
        ],
      }),
    ];
    const url = new URL(applyQueryParams("https://api.example.com/users", params));
    expect(url.searchParams.get("filters[active]")).toBe("true");
    expect(url.searchParams.get("filters[minAge]")).toBe("18");
    expect(url.searchParams.has("filters[skipped]")).toBe(false);
  });

  it("collapses a duplicate deepObject key to its last enabled value, sent once", () => {
    const params = [
      row({
        name: "filters",
        deepObject: true,
        deepObjectEntries: [
          { id: "a", key: "active", value: "true", enabled: true },
          { id: "b", key: "active", value: "false", enabled: true },
          { id: "c", key: "active", value: "ignored-because-disabled", enabled: false },
        ],
      }),
    ];
    const url = new URL(applyQueryParams("https://api.example.com/users", params));
    expect(url.searchParams.getAll("filters[active]")).toEqual(["false"]);
  });

  it("serializes an exploded array param (style: form, explode: true) as repeated keys", () => {
    const params = [
      row({
        name: "tags",
        isArray: true,
        arrayStyle: "form",
        arrayExplode: true,
        arrayValues: [
          { id: "a", value: "red", enabled: true },
          { id: "b", value: "blue", enabled: true },
          { id: "c", value: "skipped", enabled: false },
        ],
      }),
    ];
    const url = new URL(applyQueryParams("https://api.example.com/items", params));
    expect(url.searchParams.getAll("tags")).toEqual(["red", "blue"]);
  });

  it("joins a non-exploded form-style array param with a comma", () => {
    const params = [
      row({
        name: "tags",
        isArray: true,
        arrayStyle: "form",
        arrayExplode: false,
        arrayValues: [
          { id: "a", value: "red", enabled: true },
          { id: "b", value: "blue", enabled: true },
        ],
      }),
    ];
    const url = new URL(applyQueryParams("https://api.example.com/items", params));
    expect(url.searchParams.get("tags")).toBe("red,blue");
  });

  it("joins a non-exploded pipeDelimited array param with a pipe", () => {
    const params = [
      row({
        name: "tags",
        isArray: true,
        arrayStyle: "pipeDelimited",
        arrayExplode: false,
        arrayValues: [
          { id: "a", value: "red", enabled: true },
          { id: "b", value: "blue", enabled: true },
        ],
      }),
    ];
    const url = new URL(applyQueryParams("https://api.example.com/items", params));
    expect(url.searchParams.get("tags")).toBe("red|blue");
  });

  it("joins a non-exploded spaceDelimited array param with a space", () => {
    const params = [
      row({
        name: "tags",
        isArray: true,
        arrayStyle: "spaceDelimited",
        arrayExplode: false,
        arrayValues: [
          { id: "a", value: "red", enabled: true },
          { id: "b", value: "blue", enabled: true },
        ],
      }),
    ];
    const url = new URL(applyQueryParams("https://api.example.com/items", params));
    expect(url.searchParams.get("tags")).toBe("red blue");
  });

  it("omits an array param entirely when every value is disabled or empty", () => {
    const params = [
      row({
        name: "tags",
        isArray: true,
        arrayStyle: "form",
        arrayExplode: true,
        arrayValues: [{ id: "a", value: "", enabled: true }],
      }),
    ];
    const url = applyQueryParams("https://api.example.com/items", params);
    expect(new URL(url).searchParams.has("tags")).toBe(false);
  });
});

describe("resolveSecurityRequirements", () => {
  const apiKeyScheme: OpenAPISecuritySchemeData = { type: "apiKey", in: "header", name: "X-API-Key" };
  const bearerScheme: OpenAPISecuritySchemeData = { type: "http", scheme: "bearer" };

  const document: OpenAPIDocumentData = {
    openapi: "3.1.0",
    info: { title: "t", version: "1" },
    components: { securitySchemes: { apiKeyAuth: apiKeyScheme, bearerAuth: bearerScheme } },
  };

  it("resolves operation-level security over document-level", () => {
    const requirements = resolveSecurityRequirements(document, { security: [{ apiKeyAuth: [] }] });
    expect(requirements).toHaveLength(1);
    expect(requirements[0]?.[0]?.schemeName).toBe("apiKeyAuth");
  });

  it("falls back to document-level security when the operation declares none", () => {
    const withGlobal: OpenAPIDocumentData = { ...document, security: [{ bearerAuth: [] }] };
    const requirements = resolveSecurityRequirements(withGlobal, {});
    expect(requirements[0]?.[0]?.schemeName).toBe("bearerAuth");
  });

  it("drops a requirement naming an unknown scheme", () => {
    const requirements = resolveSecurityRequirements(document, { security: [{ missingScheme: [] }] });
    expect(requirements).toHaveLength(0);
  });
});

describe("applySecurity", () => {
  it("routes apiKey credentials to header/query/cookie per scheme.in", () => {
    const headerScheme: OpenAPISecuritySchemeData = { type: "apiKey", in: "header", name: "X-API-Key" };
    const headerApplication = applySecurity(
      [{ schemeName: "apiKeyAuth", scheme: headerScheme, scopes: [] }],
      { apiKeyAuth: { kind: "apiKey", value: "secret" } },
    );
    expect(headerApplication.headers).toEqual([{ name: "X-API-Key", value: "secret" }]);

    const cookieScheme: OpenAPISecuritySchemeData = { type: "apiKey", in: "cookie", name: "sessionKey" };
    const cookieApplication = applySecurity(
      [{ schemeName: "cookieAuth", scheme: cookieScheme, scopes: [] }],
      { cookieAuth: { kind: "apiKey", value: "abc" } },
    );
    expect(cookieApplication.cookies).toEqual(["sessionKey=abc"]);
    expect(cookieApplication.headers).toEqual([]);
  });

  it("base64-encodes basic auth credentials", () => {
    const basicScheme: OpenAPISecuritySchemeData = { type: "http", scheme: "basic" };
    const application = applySecurity(
      [{ schemeName: "basicAuth", scheme: basicScheme, scopes: [] }],
      { basicAuth: { kind: "basic", username: "alice", password: "wonderland" } },
    );
    expect(application.headers[0]?.value).toBe(`Basic ${btoa("alice:wonderland")}`);
  });

  it("skips a scheme with no matching credential rather than throwing", () => {
    const bearerScheme: OpenAPISecuritySchemeData = { type: "http", scheme: "bearer" };
    const application = applySecurity([{ schemeName: "bearerAuth", scheme: bearerScheme, scopes: [] }], {});
    expect(application.headers).toEqual([]);
  });

  it("applies an oauth2 client_credentials token as a Bearer header once authorized", () => {
    const oauth2Scheme: OpenAPISecuritySchemeData = {
      type: "oauth2",
      flows: { clientCredentials: { tokenUrl: "https://auth.example.com/token", scopes: {} } },
    };
    const application = applySecurity(
      [{ schemeName: "oauth2Auth", scheme: oauth2Scheme, scopes: [] }],
      { oauth2Auth: { kind: "oauth2ClientCredentials", clientId: "id", clientSecret: "secret", selectedScopes: [], accessToken: "abc123" } },
    );
    expect(application.headers).toEqual([{ name: "Authorization", value: "Bearer abc123" }]);
  });

  it("omits auth for an oauth2 client_credentials scheme with no access token yet", () => {
    const oauth2Scheme: OpenAPISecuritySchemeData = {
      type: "oauth2",
      flows: { clientCredentials: { tokenUrl: "https://auth.example.com/token", scopes: {} } },
    };
    const application = applySecurity(
      [{ schemeName: "oauth2Auth", scheme: oauth2Scheme, scopes: [] }],
      { oauth2Auth: { kind: "oauth2ClientCredentials", clientId: "id", clientSecret: "secret", selectedScopes: [] } },
    );
    expect(application.headers).toEqual([]);
  });

  it("omits auth for an expired oauth2 client_credentials token", () => {
    const oauth2Scheme: OpenAPISecuritySchemeData = {
      type: "oauth2",
      flows: { clientCredentials: { tokenUrl: "https://auth.example.com/token", scopes: {} } },
    };
    const application = applySecurity(
      [{ schemeName: "oauth2Auth", scheme: oauth2Scheme, scopes: [] }],
      {
        oauth2Auth: {
          kind: "oauth2ClientCredentials",
          clientId: "id",
          clientSecret: "secret",
          selectedScopes: [],
          accessToken: "abc123",
          obtainedAt: Date.now() - 10_000,
          expiresInSeconds: 1,
        },
      },
    );
    expect(application.headers).toEqual([]);
  });
});

describe("isOAuth2TokenExpired", () => {
  it("is false when there's no credential, or no obtainedAt/expiresInSeconds recorded", () => {
    expect(isOAuth2TokenExpired(undefined)).toBe(false);
    expect(isOAuth2TokenExpired({ obtainedAt: undefined, expiresInSeconds: undefined })).toBe(false);
    expect(isOAuth2TokenExpired({ obtainedAt: Date.now(), expiresInSeconds: undefined })).toBe(false);
  });

  it("is false while still within expiresInSeconds of obtainedAt", () => {
    expect(isOAuth2TokenExpired({ obtainedAt: Date.now(), expiresInSeconds: 3600 })).toBe(false);
  });

  it("is true once expiresInSeconds has elapsed since obtainedAt", () => {
    expect(isOAuth2TokenExpired({ obtainedAt: Date.now() - 10_000, expiresInSeconds: 1 })).toBe(true);
  });
});

describe("buildRequest", () => {
  it("assembles method, url, headers and body from every table", () => {
    const request = buildRequest({
      method: "post",
      baseUrl: "https://api.example.com",
      path: "/users/{userId}",
      pathParams: [row({ in: "path", name: "userId", value: "42" })],
      queryParams: [row({ in: "query", name: "verbose", value: "true" })],
      headerParams: [row({ in: "header", name: "accept", value: "application/json" })],
      cookieParams: [row({ in: "cookie", name: "session", value: "abc123" })],
      security: null,
      credentials: {},
      bodyText: '{"name":"Ada"}',
      bodyContentType: "application/json",
    });

    expect(request.method).toBe("post");
    expect(request.url).toBe("https://api.example.com/users/42?verbose=true");
    expect(request.headers).toContainEqual({ name: "accept", value: "application/json" });
    expect(request.headers).toContainEqual({ name: "Cookie", value: "session=abc123" });
    expect(request.headers).toContainEqual({ name: "Content-Type", value: "application/json" });
    expect(request.body).toBe('{"name":"Ada"}');
  });

  it("omits the body for GET requests even if body text is present", () => {
    const request = buildRequest({
      method: "get",
      baseUrl: "https://api.example.com",
      path: "/users",
      pathParams: [],
      queryParams: [],
      headerParams: [],
      cookieParams: [],
      security: null,
      credentials: {},
      bodyText: '{"ignored":true}',
      bodyContentType: "application/json",
    });
    expect(request.body).toBeUndefined();
  });

  it("merges cookie params and apiKey-in-cookie auth into one Cookie header", () => {
    const cookieScheme: OpenAPISecuritySchemeData = { type: "apiKey", in: "cookie", name: "apiKey" };
    const request = buildRequest({
      method: "get",
      baseUrl: "https://api.example.com",
      path: "/users",
      pathParams: [],
      queryParams: [],
      headerParams: [],
      cookieParams: [row({ in: "cookie", name: "session", value: "abc123" })],
      security: [{ schemeName: "cookieAuth", scheme: cookieScheme, scopes: [] }],
      credentials: { cookieAuth: { kind: "apiKey", value: "secret" } },
      bodyText: "",
    });

    const cookieHeader = request.headers.find((header) => header.name === "Cookie");
    expect(cookieHeader?.value).toBe("session=abc123; apiKey=secret");
    expect(request.headers.filter((header) => header.name === "Cookie")).toHaveLength(1);
  });

  it("builds a FormData body for bodyMode multipart, with no Content-Type header", () => {
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
        { id: "2", key: "skipped", isFile: false, value: "x", enabled: false, fromSpec: false },
        { id: "3", key: "avatar", isFile: true, value: "", files: [file], enabled: true, fromSpec: true },
      ],
    });

    expect(request.body).toBeInstanceOf(FormData);
    const formData = request.body as FormData;
    expect(formData.get("title")).toBe("My title");
    expect(formData.has("skipped")).toBe(false);
    expect(formData.get("avatar")).toBe(file);
    expect(request.headers.some((h) => h.name === "Content-Type")).toBe(false);
  });

  it("appends multiple files under the same field name for an array-of-files row", () => {
    const fileA = new File(["a"], "a.txt");
    const fileB = new File(["b"], "b.txt");
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
      multipartFields: [{ id: "1", key: "attachments", isFile: true, value: "", files: [fileA, fileB], enabled: true, fromSpec: true }],
    });
    const formData = request.body as FormData;
    expect(formData.getAll("attachments")).toEqual([fileA, fileB]);
  });

  it("omits the body entirely when no multipart field has a value or file", () => {
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
      multipartFields: [{ id: "1", key: "title", isFile: false, value: "", enabled: true, fromSpec: true }],
    });
    expect(request.body).toBeUndefined();
  });

  it("sends the selected File as the body for bodyMode binary, with the declared Content-Type", () => {
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
    expect(request.body).toBe(file);
    expect(request.headers).toContainEqual({ name: "Content-Type", value: "image/png" });
  });

  it("omits the body for bodyMode binary when no file was selected", () => {
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
      binaryFile: null,
    });
    expect(request.body).toBeUndefined();
    expect(request.headers.some((h) => h.name === "Content-Type")).toBe(false);
  });

  it("omits a multipart/binary body for GET requests even if fields/files are present", () => {
    const file = new File(["x"], "x.png");
    const multipartRequest = buildRequest({
      method: "get",
      baseUrl: "https://api.example.com",
      path: "/search",
      pathParams: [],
      queryParams: [],
      headerParams: [],
      cookieParams: [],
      security: null,
      credentials: {},
      bodyMode: "multipart",
      bodyText: "",
      multipartFields: [{ id: "1", key: "q", isFile: false, value: "hi", enabled: true, fromSpec: true }],
    });
    expect(multipartRequest.body).toBeUndefined();

    const binaryRequest = buildRequest({
      method: "get",
      baseUrl: "https://api.example.com",
      path: "/search",
      pathParams: [],
      queryParams: [],
      headerParams: [],
      cookieParams: [],
      security: null,
      credentials: {},
      bodyMode: "binary",
      bodyText: "",
      binaryFile: file,
    });
    expect(binaryRequest.body).toBeUndefined();
  });
});
