import type {
  HttpMethod,
  OpenAPIDocumentData,
  OpenAPIOperationData,
  OpenAPISecuritySchemeData,
  OpenAPIServerData,
} from "apiuikit/plugin";
import type {
  BodyMode,
  BuiltRequest,
  Credential,
  CredentialMap,
  EditableBodyFieldRow,
  EditableParamRow,
  ResolvedSecurityScheme,
  SecurityRequirement,
  ServerVariableValues,
} from "./types";

/** Substitutes each `{var}` in a server URL template with the user-supplied
 * override, falling back to the variable's declared default, then its first
 * enum value, then the literal token. Mirrors apiuikit's own
 * `resolveServerBaseUrl` (packages/lib/src/helpers/codeSamples.ts) — that
 * helper isn't exported from `apiuikit/plugin` by design (see the "Sending a
 * request" section of the plugins docs), so this is an intentional,
 * independent reimplementation, not a workaround. */
export function resolveServerUrl(server: OpenAPIServerData | undefined, overrides: ServerVariableValues): string {
  if (!server) return "http://localhost";

  let url = server.url;
  for (const [name, variable] of Object.entries(server.variables ?? {})) {
    const value = overrides[name] ?? variable.default ?? variable.enum?.[0] ?? `{${name}}`;
    url = url.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
  }
  return url;
}

export function defaultServerVariableValues(server: OpenAPIServerData | undefined): ServerVariableValues {
  const values: ServerVariableValues = {};
  for (const [name, variable] of Object.entries(server?.variables ?? {})) {
    values[name] = String(variable.default ?? variable.enum?.[0] ?? "");
  }
  return values;
}

/** Seeds variable inputs for a server from its declared defaults, overlaying
 * any persisted values that match that server's variable names. */
export function resolveServerVariableValues(
  server: OpenAPIServerData | undefined,
  persisted: ServerVariableValues = {},
): ServerVariableValues {
  const values = defaultServerVariableValues(server);
  for (const name of Object.keys(values)) {
    if (persisted[name] !== undefined) values[name] = persisted[name];
  }
  return values;
}

/** Substitutes `{token}` path placeholders from the path-params table.
 * Falls back to the literal token (unencoded) when a declared path param has
 * no value typed in yet, so the URL stays readable rather than becoming
 * `%7BpetId%7D` mid-edit. */
export function buildRequestPath(path: string, pathParams: EditableParamRow[]): string {
  return path.replace(/\{([^}]+)\}/g, (match, token: string) => {
    const row = pathParams.find((p) => p.enabled && p.name === token);
    if (!row || row.value === "") return match;
    return encodeURIComponent(row.value);
  });
}

const ARRAY_STYLE_DELIMITERS: Record<string, string> = {
  spaceDelimited: " ",
  pipeDelimited: "|",
  form: ",",
};

/** Appends query params to `url`, including `style: deepObject` params
 * (`filters[active]=true`) from their expanded sub-table, and `type: array`
 * params serialized per their `style`/`explode` — exploded as repeated keys
 * (`id=3&id=4`, the default for `style: form`), or joined with the style's
 * delimiter otherwise (`,` for `form`, `|` for `pipeDelimited`, a space for
 * `spaceDelimited` — URLSearchParams percent-encodes the space itself).
 *
 * Builds the query string on its own `URLSearchParams` and concatenates it
 * onto `url` as a string, rather than round-tripping the whole URL through
 * `new URL(url).toString()` — that reserialization percent-encodes any
 * literal `{token}` still sitting in the path from an unset path param
 * (`buildRequestPath` deliberately leaves those unresolved and unencoded so
 * the URL stays readable while it's being filled in), turning it into
 * `%7Btoken%7D` even when there are zero query params to add. */
export function applyQueryParams(url: string, queryParams: EditableParamRow[]): string {
  const searchParams = new URLSearchParams();
  for (const row of queryParams) {
    if (!row.enabled) continue;
    if (row.isArray) {
      const values = (row.arrayValues ?? []).filter((entry) => entry.enabled && entry.value !== "").map((entry) => entry.value);
      if (values.length === 0) continue;
      if (row.arrayExplode) {
        for (const value of values) searchParams.append(row.name, value);
      } else {
        const delimiter = ARRAY_STYLE_DELIMITERS[row.arrayStyle ?? "form"];
        searchParams.append(row.name, values.join(delimiter));
      }
    } else if (row.deepObject) {
      // Last enabled entry for a given key wins, rather than sending
      // `filters[active]=true&filters[active]=false` for an ambiguous
      // duplicate — a query string can't express "override", so collapsing
      // here is the only way to keep the request well-defined.
      const byKey = new Map<string, string>();
      for (const entry of row.deepObjectEntries ?? []) {
        if (!entry.enabled || entry.key === "") continue;
        byKey.set(entry.key, entry.value);
      }
      for (const [key, value] of byKey) searchParams.append(`${row.name}[${key}]`, value);
    } else if (row.value !== "") {
      searchParams.append(row.name, row.value);
    }
  }
  const query = searchParams.toString();
  return query ? `${url}${url.includes("?") ? "&" : "?"}${query}` : url;
}

/** Resolves `operation.security ?? document.security` against
 * `components.securitySchemes` into a list of OR-alternatives, each an
 * AND-list of resolved schemes with their scopes — mirrors the resolution
 * `PathOperation.tsx` already does for the read-only Authorization display,
 * unlike the snippet-only `resolveAuthPlaceholders` helper (which only ever
 * looks at `security[0]`). Requirements naming an unknown scheme are
 * dropped entirely (an AND-requirement apiuikit can't fully satisfy isn't a
 * usable alternative). */
export function resolveSecurityRequirements(
  document: OpenAPIDocumentData,
  operation: OpenAPIOperationData | undefined,
): SecurityRequirement[] {
  const requirements = operation?.security ?? document.security ?? [];
  const schemes = document.components?.securitySchemes ?? {};

  const resolved: SecurityRequirement[] = [];
  for (const requirement of requirements) {
    const names = Object.keys(requirement);
    if (names.length === 0) continue;

    const resolvedSchemes: ResolvedSecurityScheme[] = [];
    let unresolvable = false;
    for (const name of names) {
      const scheme = schemes[name];
      if (!scheme) {
        unresolvable = true;
        break;
      }
      resolvedSchemes.push({ schemeName: name, scheme, scopes: requirement[name] ?? [] });
    }
    if (!unresolvable) resolved.push(resolvedSchemes);
  }
  return resolved;
}

interface AuthApplication {
  headers: Array<{ name: string; value: string }>;
  queryParams: Array<{ name: string; value: string }>;
  cookies: string[];
}

/** A token with no `expires_in` in its response is treated as non-expiring
 * — some providers omit it for tokens meant to be long-lived, and this
 * plugin has no way to distinguish that from "forgot to report it," so
 * absence isn't treated as "expires immediately." Shared by both
 * client_credentials and authorization_code credentials, which carry the
 * same `obtainedAt`/`expiresInSeconds` shape. */
export function isOAuth2TokenExpired(credential: { obtainedAt?: number; expiresInSeconds?: number } | undefined): boolean {
  if (!credential || credential.obtainedAt === undefined || credential.expiresInSeconds === undefined) return false;
  return Date.now() > credential.obtainedAt + credential.expiresInSeconds * 1000;
}

function applyOneScheme(scheme: OpenAPISecuritySchemeData, credential: Credential | undefined): AuthApplication {
  const empty: AuthApplication = { headers: [], queryParams: [], cookies: [] };
  if (!credential) return empty;

  if (scheme.type === "apiKey" && credential.kind === "apiKey") {
    // openapi-types declares ApiKeySecurityScheme.in as a plain `string`, not
    // a literal union, even though the spec only allows these three values.
    if (scheme.in === "query") return { headers: [], queryParams: [{ name: scheme.name, value: credential.value }], cookies: [] };
    if (scheme.in === "cookie") {
      return { headers: [], queryParams: [], cookies: [`${scheme.name}=${credential.value}`] };
    }
    return { headers: [{ name: scheme.name, value: credential.value }], queryParams: [], cookies: [] };
  }

  if (scheme.type === "http" && scheme.scheme?.toLowerCase() === "bearer" && credential.kind === "bearer") {
    return { headers: [{ name: "Authorization", value: `Bearer ${credential.token}` }], queryParams: [], cookies: [] };
  }

  if (scheme.type === "http" && scheme.scheme?.toLowerCase() === "basic" && credential.kind === "basic") {
    const encoded = btoa(`${credential.username}:${credential.password}`);
    return { headers: [{ name: "Authorization", value: `Basic ${encoded}` }], queryParams: [], cookies: [] };
  }

  if (scheme.type === "oauth2" && (credential.kind === "oauth2ClientCredentials" || credential.kind === "oauth2AuthorizationCode")) {
    if (!credential.accessToken || isOAuth2TokenExpired(credential)) return empty;
    return { headers: [{ name: "Authorization", value: `${credential.tokenType ?? "Bearer"} ${credential.accessToken}` }], queryParams: [], cookies: [] };
  }

  if ((scheme.type === "oauth2" || scheme.type === "openIdConnect") && credential.kind === "manual") {
    return { headers: [{ name: "Authorization", value: `Bearer ${credential.token}` }], queryParams: [], cookies: [] };
  }

  return empty;
}

/** Applies every scheme in a chosen (AND) security requirement using the
 * user's entered credentials. Schemes with no matching credential yet are
 * silently skipped rather than blocking the request — an incomplete auth
 * setup should still be sendable so the user can see the resulting error. */
export function applySecurity(requirement: SecurityRequirement, credentials: CredentialMap): AuthApplication {
  const headers: Array<{ name: string; value: string }> = [];
  const queryParams: Array<{ name: string; value: string }> = [];
  const cookies: string[] = [];
  for (const { schemeName, scheme } of requirement) {
    const application = applyOneScheme(scheme, credentials[schemeName]);
    headers.push(...application.headers);
    queryParams.push(...application.queryParams);
    cookies.push(...application.cookies);
  }
  return { headers, queryParams, cookies };
}

export interface BuildRequestInput {
  method: HttpMethod;
  baseUrl: string;
  path: string;
  pathParams: EditableParamRow[];
  queryParams: EditableParamRow[];
  headerParams: EditableParamRow[];
  cookieParams: EditableParamRow[];
  security: SecurityRequirement | null;
  credentials: CredentialMap;
  /** Defaults to `"text"` — every existing caller (JSON/XML/plain bodies)
   * only ever set `bodyText`, so this stays optional rather than forcing
   * every call site to spell out the common case. */
  bodyMode?: BodyMode;
  bodyText: string;
  bodyContentType?: string;
  /** `bodyMode: "multipart"` only. */
  multipartFields?: EditableBodyFieldRow[];
  /** `bodyMode: "binary"` only. */
  binaryFile?: File | null;
}

/** Builds a `multipart/form-data` body from the editable field rows —
 * `undefined` when nothing enabled actually has a value/file, so callers
 * can tell "no body" from "empty FormData" the same way the text-body path
 * already treats an empty trimmed string as no body. */
function buildMultipartBody(fields: EditableBodyFieldRow[]): FormData | undefined {
  const formData = new FormData();
  let hasEntry = false;
  for (const row of fields) {
    if (!row.enabled || row.key === "") continue;
    if (row.isFile) {
      for (const file of row.files ?? []) {
        formData.append(row.key, file);
        hasEntry = true;
      }
    } else if (row.value !== "") {
      formData.append(row.key, row.value);
      hasEntry = true;
    }
  }
  return hasEntry ? formData : undefined;
}

/** Assembles a ready-to-`fetch()` request from the panel's editable tables —
 * the plugin's own equivalent of apiuikit's internal `buildHarRequest`, but
 * built for real execution: every enabled row (spec-declared or
 * user-added) is included as typed, real auth values are used instead of
 * placeholders, and query params are appended straight onto the URL rather
 * than kept in a side array for a snippet library to reassemble. */
export function buildRequest(input: BuildRequestInput): BuiltRequest {
  const resolvedPath = buildRequestPath(input.path, input.pathParams);
  let url = `${input.baseUrl.replace(/\/$/, "")}${resolvedPath}`;
  url = applyQueryParams(url, input.queryParams);

  const headers: Array<{ name: string; value: string }> = [];
  for (const row of input.headerParams) {
    if (row.enabled && row.value !== "") headers.push({ name: row.name, value: row.value });
  }

  const cookiePairs: string[] = [];
  for (const row of input.cookieParams) {
    if (row.enabled && row.value !== "") cookiePairs.push(`${row.name}=${row.value}`);
  }

  if (input.security) {
    const auth = applySecurity(input.security, input.credentials);
    headers.push(...auth.headers);
    cookiePairs.push(...auth.cookies);
    if (auth.queryParams.length > 0) {
      // String concatenation, not `new URL(url).toString()` — see
      // `applyQueryParams`'s doc comment for why round-tripping through
      // `URL` here would mangle an unresolved `{pathParam}` token.
      const authSearch = new URLSearchParams();
      for (const q of auth.queryParams) authSearch.append(q.name, q.value);
      url = `${url}${url.includes("?") ? "&" : "?"}${authSearch.toString()}`;
    }
  }

  if (cookiePairs.length > 0) headers.push({ name: "Cookie", value: cookiePairs.join("; ") });

  const canHaveBody = input.method !== "get" && input.method !== "head";
  const bodyMode = input.bodyMode ?? "text";
  let body: BuiltRequest["body"];

  if (canHaveBody && bodyMode === "multipart") {
    body = buildMultipartBody(input.multipartFields ?? []);
    // No Content-Type header here — fetch derives `multipart/form-data;
    // boundary=...` from the FormData body itself; setting our own would
    // omit the boundary and break the request.
  } else if (canHaveBody && bodyMode === "binary") {
    if (input.binaryFile) {
      body = input.binaryFile;
      if (input.bodyContentType) headers.push({ name: "Content-Type", value: input.bodyContentType });
    }
  } else if (canHaveBody) {
    const trimmedBody = input.bodyText.trim();
    if (trimmedBody.length > 0) {
      body = trimmedBody;
      if (input.bodyContentType) headers.push({ name: "Content-Type", value: input.bodyContentType });
    }
  }

  return {
    method: input.method,
    url,
    headers,
    body,
  };
}
