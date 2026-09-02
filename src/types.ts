import type {
  HttpMethod,
  OpenAPIParameterData,
  OpenAPISecuritySchemeData,
  OpenAPIServerData,
} from "apiuikit/plugin";

export type ParamLocation = "path" | "query" | "header" | "cookie";

/** `useDocumentContext().deref` — resolves a JSON Pointer against the
 * ambient document. apiuikit's own document normalization resolves most
 * `$ref`s before handing a plugin its document, but circular schema
 * references are deliberately left as unresolved `{ $ref }` nodes; anywhere
 * this plugin reads a parameter's `schema` needs this as a fallback. */
export type Deref = (ref: string) => unknown;

/** A single editable row in one of the params/headers/cookies tables. Rows
 * seeded from the spec carry `param`; rows the user added by hand don't. */
export interface EditableParamRow {
  id: string;
  in: ParamLocation;
  name: string;
  value: string;
  enabled: boolean;
  fromSpec: boolean;
  required?: boolean;
  description?: string;
  /** `style: deepObject` params (e.g. `filters[active]=true`) expand into a
   * nested key/value sub-table instead of a single value input. */
  deepObject?: boolean;
  deepObjectEntries?: EditableDeepObjectEntry[];
  /** `type: array` query params (not `deepObject`) expand into a list of
   * value rows instead of a single value input — serialized per
   * `arrayStyle`/`arrayExplode` in `applyQueryParams`. */
  isArray?: boolean;
  arrayValues?: EditableArrayValue[];
  arrayStyle?: ArrayQueryStyle;
  arrayExplode?: boolean;
  param?: OpenAPIParameterData;
}

export interface EditableDeepObjectEntry {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface EditableArrayValue {
  id: string;
  value: string;
  enabled: boolean;
}

/** OpenAPI's query-param array styles this plugin serializes (`deepObject`
 * is object-only and handled separately; `matrix`/`label`/`simple` are
 * path/header styles, out of scope here). */
export type ArrayQueryStyle = "form" | "spaceDelimited" | "pipeDelimited";

export type ResolvedSecurityScheme = {
  schemeName: string;
  scheme: OpenAPISecuritySchemeData;
  scopes: string[];
};

/** One OR-alternative from `security`/`document.security` — every entry in
 * the record must be satisfied together (AND), alternatives are OR. */
export type SecurityRequirement = ResolvedSecurityScheme[];

export type ApiKeyCredential = { kind: "apiKey"; value: string };
export type BearerCredential = { kind: "bearer"; token: string };
export type BasicCredential = { kind: "basic"; username: string; password: string };
/** oauth2/openIdConnect fallback when no automated flow is implemented for
 * the scheme's declared flow(s) — the user pastes an already-obtained
 * token. */
export type ManualTokenCredential = { kind: "manual"; token: string };

/** OAuth2 `client_credentials` flow (RFC 6749 §4.4) — the one OAuth2 flow
 * this plugin runs for real, since it needs no redirect/user interaction.
 * `accessToken` is set after a successful "Authorize" click;
 * `obtainedAt`/`expiresInSeconds` (from the token response's `expires_in`,
 * when present) let `isOAuth2TokenExpired` decide whether a stored token is
 * still usable without the caller tracking wall-clock time itself. */
export type OAuth2ClientCredentialsCredential = {
  kind: "oauth2ClientCredentials";
  clientId: string;
  clientSecret: string;
  selectedScopes: string[];
  accessToken?: string;
  tokenType?: string;
  obtainedAt?: number;
  expiresInSeconds?: number;
};

/** OAuth2 `authorization_code` flow (RFC 6749 §4.1) — run via a login
 * popup (`oauth2AuthorizationCode.ts`'s `awaitAuthorizationCode`) since it
 * needs a redirect through the user's own login UI. `redirectUri` is
 * editable per-credential (not fixed by the plugin) because it must match
 * whatever URI is registered with the provider for this client. `clientId`
 * is required; `clientSecret` is optional — empty means a public client
 * (RFC 6749 §2.1), authenticating the token exchange without a secret. */
export type OAuth2AuthorizationCodeCredential = {
  kind: "oauth2AuthorizationCode";
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** RFC 7636 PKCE — defaults to on (undefined treated as `true`) when a
   * scheme's flow doesn't otherwise force a choice, matching modern OAuth
   * guidance to use it even for confidential clients. */
  usePkce?: boolean;
  selectedScopes: string[];
  accessToken?: string;
  tokenType?: string;
  obtainedAt?: number;
  expiresInSeconds?: number;
  refreshToken?: string;
};

export type Credential =
  | ApiKeyCredential
  | BearerCredential
  | BasicCredential
  | ManualTokenCredential
  | OAuth2ClientCredentialsCredential
  | OAuth2AuthorizationCodeCredential;

/** Keyed by security scheme name (`components.securitySchemes` key). */
export type CredentialMap = Record<string, Credential>;

export interface ServerVariableValues {
  [name: string]: string;
}

/** Which body editor a request body's declared content type calls for:
 * `text` (JSON/XML/plain — the raw-textarea case this plugin has always
 * supported), `multipart` (`multipart/form-data`, a mix of text fields and
 * file uploads), or `binary` (a single-file body, e.g. `image/png` /
 * `application/octet-stream`). */
export type BodyMode = "text" | "multipart" | "binary";

/** One editable field in a `multipart/form-data` body, built from the
 * content type's object schema — a text input for an ordinary property, a
 * file picker for a `type: string, format: binary` one. Rows seeded from
 * the spec carry `fromSpec: true`; user-added rows (like `EditableParamRow`)
 * don't and can be removed/retyped. */
export interface EditableBodyFieldRow {
  id: string;
  key: string;
  isFile: boolean;
  /** Text value when `!isFile`. */
  value: string;
  /** Selected file(s) when `isFile` — more than one only for an
   * array-of-binary property (repeated parts under the same field name). */
  files?: File[];
  enabled: boolean;
  fromSpec: boolean;
  required?: boolean;
  description?: string;
}

export interface BuiltRequest {
  method: HttpMethod;
  url: string;
  headers: Array<{ name: string; value: string }>;
  /** `FormData` for a `multipart` body (fetch derives the `Content-Type`
   * boundary from it itself — no header is set for that case) or a single
   * `File` for a `binary` body; a plain string otherwise. */
  body?: string | FormData | File;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: string;
  durationMs: number;
}

export type FetchOutcome =
  | { kind: "success"; result: FetchResult }
  | { kind: "cors-error"; message: string }
  | { kind: "error"; message: string };

export interface TryItPluginOptions {
  /** When set, requests are sent to `${proxyUrl}?target=<encoded request url>`
   * instead of the API origin directly, so a host app can route around CORS
   * via its own proxy. @apiuikit/openapi-try-it-plugin does not ship a hosted proxy. */
  proxyUrl?: string;
}

export type { HttpMethod, OpenAPIServerData };
