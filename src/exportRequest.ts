import { randomId } from "./randomId";
import type { BuiltRequest, FetchOutcome } from "./types";

export type ExportFormat = "postman" | "insomnia" | "har";

export interface ExportRequestInput {
  request: BuiltRequest;
  /** Collection / workspace / HAR-entry name — typically the operation summary. */
  name: string;
  /** HAR `startedDateTime` and Insomnia `__export_date`. Defaults to now. */
  exportedAt?: Date;
  /** When the last Send succeeded, the HAR entry includes that response. */
  outcome?: FetchOutcome | null;
  /** Injected in tests so Insomnia resource ids are deterministic. */
  insomniaIds?: { workspace: string; request: string };
}

interface NameValue {
  name: string;
  value: string;
}

interface SerializedMultipartParam {
  name: string;
  value?: string;
  fileName?: string;
  contentType?: string;
}

type SerializedBody =
  | { kind: "none" }
  | { kind: "text"; mimeType: string; text: string }
  | { kind: "multipart"; params: SerializedMultipartParam[] }
  | { kind: "file"; mimeType: string; fileName: string };

const CREATOR_NAME = "@apiuikit/openapi-try-it-plugin";
const POSTMAN_SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

function headerValue(headers: Array<{ name: string; value: string }>, name: string): string | undefined {
  return headers.find((header) => header.name.toLowerCase() === name)?.value;
}

/** Pulls query pairs off a URL even when `new URL` rejects it (relative
 * server URLs, unresolved `{path}` tokens that some engines choke on). */
export function queryPairsFromUrl(url: string): NameValue[] {
  try {
    return [...new URL(url).searchParams.entries()].map(([name, value]) => ({ name, value }));
  } catch {
    const query = url.split("#")[0]?.split("?")[1];
    if (!query) return [];
    return [...new URLSearchParams(query).entries()].map(([name, value]) => ({ name, value }));
  }
}

function cookiesFromHeaders(headers: Array<{ name: string; value: string }>): NameValue[] {
  const cookie = headerValue(headers, "cookie");
  if (!cookie) return [];
  return cookie
    .split(";")
    .map((part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return { name: part.trim(), value: "" };
      return { name: part.slice(0, separator).trim(), value: part.slice(separator + 1).trim() };
    })
    .filter((entry) => entry.name.length > 0);
}

/** File bytes aren't embeddable in a JSON export in a way another client
 * can round-trip, so multipart/binary bodies keep field names and filenames
 * and drop the contents — the importer has to re-attach the files. */
function serializeBody(request: BuiltRequest): SerializedBody {
  if (request.body === undefined) return { kind: "none" };
  if (typeof request.body === "string") {
    return {
      kind: "text",
      mimeType: headerValue(request.headers, "content-type") ?? "text/plain",
      text: request.body,
    };
  }
  if (typeof FormData !== "undefined" && request.body instanceof FormData) {
    const params: SerializedMultipartParam[] = [];
    request.body.forEach((value, name) => {
      if (typeof value === "string") {
        params.push({ name, value });
      } else {
        params.push({
          name,
          fileName: value.name,
          contentType: value.type || undefined,
        });
      }
    });
    return { kind: "multipart", params };
  }
  if (typeof File !== "undefined" && request.body instanceof File) {
    return {
      kind: "file",
      mimeType: headerValue(request.headers, "content-type") ?? (request.body.type || "application/octet-stream"),
      fileName: request.body.name,
    };
  }
  return { kind: "none" };
}

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function insomniaId(prefix: "wrk" | "req"): string {
  return `${prefix}_${randomId()}`;
}

function postmanRawLanguage(mimeType: string): "json" | "xml" | "text" {
  if (/json/i.test(mimeType)) return "json";
  if (/xml/i.test(mimeType)) return "xml";
  return "text";
}

function postmanUrl(url: string): Record<string, unknown> {
  const query = queryPairsFromUrl(url).map(({ name, value }) => ({ key: name, value }));
  try {
    const parsed = new URL(url);
    const result: Record<string, unknown> = {
      raw: url,
      protocol: parsed.protocol.replace(/:$/, ""),
      host: parsed.hostname.split("."),
      path: parsed.pathname.split("/").filter((segment) => segment.length > 0),
    };
    if (parsed.port) result.port = parsed.port;
    if (query.length > 0) result.query = query;
    return result;
  } catch {
    return query.length > 0 ? { raw: url, query } : { raw: url };
  }
}

function postmanBody(body: SerializedBody): Record<string, unknown> | undefined {
  if (body.kind === "none") return undefined;
  if (body.kind === "text") {
    return {
      mode: "raw",
      raw: body.text,
      options: { raw: { language: postmanRawLanguage(body.mimeType) } },
    };
  }
  if (body.kind === "multipart") {
    return {
      mode: "formdata",
      formdata: body.params.map((param) =>
        param.fileName
          ? { key: param.name, type: "file", src: param.fileName }
          : { key: param.name, type: "text", value: param.value ?? "" },
      ),
    };
  }
  return { mode: "file", file: { src: body.fileName } };
}

function insomniaBody(body: SerializedBody): Record<string, unknown> {
  if (body.kind === "none") return {};
  if (body.kind === "text") return { mimeType: body.mimeType, text: body.text };
  if (body.kind === "multipart") {
    return {
      mimeType: "multipart/form-data",
      params: body.params.map((param) =>
        param.fileName
          ? { name: param.name, type: "file", fileName: param.fileName, value: "" }
          : { name: param.name, value: param.value ?? "" },
      ),
    };
  }
  return { mimeType: body.mimeType, fileName: body.fileName };
}

function harPostData(body: SerializedBody): Record<string, unknown> | undefined {
  if (body.kind === "none") return undefined;
  if (body.kind === "text") return { mimeType: body.mimeType, text: body.text };
  if (body.kind === "multipart") {
    return {
      mimeType: "multipart/form-data",
      params: body.params.map((param) =>
        param.fileName
          ? {
              name: param.name,
              fileName: param.fileName,
              contentType: param.contentType ?? "application/octet-stream",
            }
          : { name: param.name, value: param.value ?? "" },
      ),
    };
  }
  // HAR has no file-attachment slot for a raw binary body — a placeholder
  // string is honest about the omission and still importable as a request.
  return {
    mimeType: body.mimeType,
    text: `[binary file: ${body.fileName}; contents not included]`,
  };
}

function harResponse(outcome: FetchOutcome | null | undefined): Record<string, unknown> {
  if (outcome?.kind !== "success") {
    return {
      status: 0,
      statusText: "",
      httpVersion: "HTTP/1.1",
      cookies: [],
      headers: [],
      content: { size: 0, mimeType: "application/octet-stream" },
      redirectURL: "",
      headersSize: -1,
      bodySize: -1,
    };
  }

  const { result } = outcome;
  const mimeType = result.headers.find(([name]) => name.toLowerCase() === "content-type")?.[1] ?? "text/plain";
  return {
    status: result.status,
    statusText: result.statusText,
    httpVersion: "HTTP/1.1",
    cookies: [],
    headers: result.headers.map(([name, value]) => ({ name, value })),
    content: { size: utf8ByteLength(result.body), mimeType, text: result.body },
    redirectURL: "",
    headersSize: -1,
    bodySize: utf8ByteLength(result.body),
  };
}

/** Placeholder written in place of a credential. `{{name}}` rather than a
 * fixed "REDACTED" string because Postman and Insomnia both resolve that
 * syntax as a variable — the export stays runnable once the importer fills
 * the value in, instead of failing with a literal token in the header. */
function placeholderFor(name: string): string {
  return `{{${name}}}`;
}

/** Rewrites only the values of the named query parameters, by string
 * surgery on the query portion. Deliberately not `new URL(...)`: see
 * `queryPairsFromUrl` for why round-tripping mangles an unresolved
 * `{pathParam}` token. Placeholders are left unencoded, which is what
 * Postman expects of `{{var}}` in a URL. */
function redactUrlQuery(url: string, names: string[]): string {
  if (names.length === 0) return url;
  const separator = url.indexOf("?");
  if (separator === -1) return url;

  const lowered = names.map((name) => name.toLowerCase());
  const [base, query] = [url.slice(0, separator), url.slice(separator + 1)];
  const redacted = query
    .split("&")
    .map((pair) => {
      const equals = pair.indexOf("=");
      const rawName = equals === -1 ? pair : pair.slice(0, equals);
      let decodedName = rawName;
      try {
        decodedName = decodeURIComponent(rawName);
      } catch {
        // Malformed percent-encoding — compare the raw name instead.
      }
      if (!lowered.includes(decodedName.toLowerCase())) return pair;
      return `${rawName}=${placeholderFor(decodedName)}`;
    })
    .join("&");

  return `${base}?${redacted}`;
}

/**
 * Strips the user's credentials out of a request before it is written to a
 * file. Exports are routinely attached to bug reports and support tickets,
 * so a live token in a downloaded .har outlives the tab it was typed into —
 * the value is replaced by a `{{name}}` placeholder the importing tool can
 * prompt for.
 *
 * `buildRequest` marks which parts are credential-derived (see
 * `RequestSecrets`); this never inspects values, so a token that happens to
 * match a non-secret string is not redacted by accident, and an API key in
 * a custom header is redacted even though its name is unremarkable.
 */
export function redactSecrets(request: BuiltRequest): BuiltRequest {
  const { queryNames } = request.secrets;
  const headerNames = secretHeaderNames(request);
  if (headerNames.length === 0 && queryNames.length === 0) return request;

  const loweredHeaders = headerNames.map((name) => name.toLowerCase());
  return {
    ...request,
    url: redactUrlQuery(request.url, queryNames),
    headers: request.headers.map((header) =>
      loweredHeaders.includes(header.name.toLowerCase())
        ? { ...header, value: placeholderFor(header.name) }
        : header,
    ),
  };
}

/** Headers that carry credentials by convention, redacted even when the
 * value didn't come from the auth panel — someone typing a token straight
 * into the headers table is the likeliest way a secret reaches an export
 * without `buildRequest` knowing it is one. */
const ALWAYS_SECRET_HEADERS = ["authorization", "proxy-authorization", "cookie"];

/** Scheme-derived header names plus the ones sensitive by convention.
 * Matched case-insensitively; the request's own casing is preserved in the
 * placeholder. */
function secretHeaderNames(request: BuiltRequest): string[] {
  const names = new Set(request.secrets.headerNames);
  for (const header of request.headers) {
    if (ALWAYS_SECRET_HEADERS.includes(header.name.toLowerCase())) names.add(header.name);
  }
  return [...names];
}

/** Whether the Cookie header was replaced by a placeholder. */
function isCookieRedacted(request: BuiltRequest): boolean {
  return secretHeaderNames(request).some((name) => name.toLowerCase() === "cookie");
}

/** Every credential placeholder in a redacted request, for tools that can
 * declare the variables up front (Postman's collection-level `variable`). */
function redactedNames(request: BuiltRequest): string[] {
  return [...new Set([...secretHeaderNames(request), ...request.secrets.queryNames])];
}

/** Postman Collection v2.1 — a one-request collection matching the panel's
 * current assembled request (resolved URL, typed-in body). Credentials are
 * redacted to `{{name}}` placeholders and declared as collection variables,
 * so Postman shows them as blanks to fill rather than shipping live secrets
 * in the file. */
export function exportAsPostmanCollection(input: ExportRequestInput): Record<string, unknown> {
  const redacted = redactSecrets(input.request);
  const body = postmanBody(serializeBody(redacted));
  const request: Record<string, unknown> = {
    method: redacted.method.toUpperCase(),
    header: redacted.headers.map((header) => ({ key: header.name, value: header.value })),
    url: postmanUrl(redacted.url),
  };
  if (body) request.body = body;

  const variables = redactedNames(input.request);
  const collection: Record<string, unknown> = {
    info: {
      name: input.name,
      schema: POSTMAN_SCHEMA,
    },
    item: [{ name: input.name, request }],
  };
  if (variables.length > 0) {
    collection.variable = variables.map((key) => ({ key, value: "", type: "string" }));
  }
  return collection;
}

/** Insomnia export format v4 (JSON). v4 still imports in current Insomnia;
 * the newer YAML v5 format isn't required for a single-request handoff. */
export function exportAsInsomnia(input: ExportRequestInput): Record<string, unknown> {
  const redacted = redactSecrets(input.request);
  const exportedAt = input.exportedAt ?? new Date();
  const timestamp = exportedAt.getTime();
  const workspaceId = input.insomniaIds?.workspace ?? insomniaId("wrk");
  const requestId = input.insomniaIds?.request ?? insomniaId("req");

  return {
    _type: "export",
    __export_format: 4,
    __export_date: exportedAt.toISOString(),
    __export_source: CREATOR_NAME,
    resources: [
      {
        _id: workspaceId,
        parentId: null,
        modified: timestamp,
        created: timestamp,
        name: input.name,
        description: "",
        scope: "collection",
        _type: "workspace",
      },
      {
        _id: requestId,
        parentId: workspaceId,
        modified: timestamp,
        created: timestamp,
        url: redacted.url,
        name: input.name,
        description: "",
        method: redacted.method.toUpperCase(),
        body: insomniaBody(serializeBody(redacted)),
        parameters: [],
        headers: redacted.headers.map((header) => ({ name: header.name, value: header.value })),
        authentication: {},
        metaSortKey: -1,
        isPrivate: false,
        settingStoreCookies: true,
        settingSendCookies: true,
        settingDisableRenderRequestBody: false,
        settingEncodeUrl: true,
        settingRebuildPath: true,
        settingFollowRedirects: "global",
        _type: "request",
      },
    ],
  };
}

/** HAR 1.2 log with a single entry. Query string lives both on `url` and in
 * `queryString` (Chrome's own HAR shape); cookies are split out of the
 * Cookie header into `cookies` as well as left on `headers`, matching what
 * the panel assembled even though a browser would strip that header on send. */
export function exportAsHar(input: ExportRequestInput): Record<string, unknown> {
  const redacted = redactSecrets(input.request);
  const exportedAt = input.exportedAt ?? new Date();
  const body = serializeBody(redacted);
  const postData = harPostData(body);
  const durationMs = input.outcome?.kind === "success" ? input.outcome.result.durationMs : 0;

  const request: Record<string, unknown> = {
    method: redacted.method.toUpperCase(),
    url: redacted.url,
    httpVersion: "HTTP/1.1",
    // Empty once the Cookie header is redacted: this array is a convenience
    // mirror of that header, and splitting a `{{Cookie}}` placeholder on
    // ";" would yield a junk entry rather than anything importable.
    cookies: isCookieRedacted(input.request) ? [] : cookiesFromHeaders(redacted.headers),
    headers: redacted.headers.map((header) => ({ name: header.name, value: header.value })),
    queryString: queryPairsFromUrl(redacted.url),
    headersSize: -1,
    bodySize: body.kind === "text" ? utf8ByteLength(body.text) : -1,
  };
  if (postData) request.postData = postData;

  return {
    log: {
      version: "1.2",
      creator: { name: CREATOR_NAME, version: "0.1.0" },
      entries: [
        {
          startedDateTime: exportedAt.toISOString(),
          time: durationMs,
          request,
          response: harResponse(input.outcome),
          cache: {},
          timings: { send: 0, wait: durationMs, receive: 0 },
        },
      ],
    },
  };
}

export function buildExport(format: ExportFormat, input: ExportRequestInput): Record<string, unknown> {
  if (format === "postman") return exportAsPostmanCollection(input);
  if (format === "insomnia") return exportAsInsomnia(input);
  return exportAsHar(input);
}

export function filenameForExport(format: ExportFormat, method: string, path: string): string {
  const slug =
    `${method}-${path}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "request";
  if (format === "postman") return `${slug}.postman_collection.json`;
  if (format === "insomnia") return `${slug}.insomnia.json`;
  return `${slug}.har`;
}
