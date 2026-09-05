# @apiuikit/openapi-try-it-plugin

A "Try it out" request-sending plugin for [apiuikit](https://apiuikit.com), filling the `openapi.operation.tab` slot with a real, fetch-executing panel — path/query/header/cookie parameter tables (including `style: deepObject` and array-style query params), a server-variable picker, API key / Bearer / Basic / OAuth2 `client_credentials` / OAuth2 `authorization_code` (with PKCE) auth with masked/reveal secret inputs, a JSON/multipart/binary body editor, a response viewer, and export of the current request to Postman, Insomnia, or HAR.

Not bundled into apiuikit itself — install and register it explicitly.

## Install

```sh
npm install @apiuikit/openapi-try-it-plugin
```

## Usage

```tsx
import { OpenAPI } from "apiuikit";
import tryItPlugin from "@apiuikit/openapi-try-it-plugin";
import "apiuikit/style.css";
import doc from "./openapi.json";

const plugins = [tryItPlugin];

export default function App() {
  return <OpenAPI openapi={doc} plugins={plugins} />;
}
```

Keep the `plugins` array's identity stable (module-level, or `useMemo`) — apiuikit re-registers plugins on every new array literal.

### Routing around CORS

A plugin sending requests straight from the browser will be blocked by CORS on any API that doesn't send permissive `Access-Control-Allow-Origin` headers — true of most private/internal APIs. This package doesn't ship a hosted proxy; if you have your own, point requests at it:

```ts
import { createTryItPlugin } from "@apiuikit/openapi-try-it-plugin";

const plugins = [createTryItPlugin({ proxyUrl: "https://your-proxy.example.com/tryit" })];
```

When set, requests go to `${proxyUrl}?target=<url-encoded target URL>` instead of the API origin directly.

## Authentication

### Supported

| Scheme | OpenAPI type | What the panel does |
|--------|-------------|---------------------|
| API key (header / query) | `apiKey` | Key input field, sent in the declared location |
| HTTP Bearer | `http` scheme: bearer | Masked token input, sent as `Authorization: Bearer <token>` |
| HTTP Basic | `http` scheme: basic | Username + masked password inputs, sent as `Authorization: Basic <base64>` |
| OAuth2 `client_credentials` | `oauth2` flows.clientCredentials | Real token fetch — Token URL, Client ID/Secret, scope checkboxes, Authorize button; token expiry tracked |
| OAuth2 `authorization_code` (+ PKCE) | `oauth2` flows.authorizationCode | Real login popup — Authorization/Token URL, Client ID, optional Client Secret, editable Redirect URI, Use PKCE toggle (on by default, S256 only), scope checkboxes, Authorize button |

**`client_credentials` priority:** when a scheme declares both `clientCredentials` and `authorizationCode`, the panel renders the `client_credentials` UI. To test the `authorization_code` UI, use a scheme that only declares `authorizationCode`.

**`authorization_code` redirect URI constraint:** the redirect URI must be same-origin with the page apiuikit is embedded on. The plugin polls the popup's URL (`popup.location.href` only becomes readable once same-origin) — no bundled callback page or `postMessage` bridge is used. PKCE supports `S256` only (`plain` is not implemented).

**Cookie API keys (not supported in practice):** the browser's Fetch API treats `Cookie` as a [forbidden header](https://fetch.spec.whatwg.org/#forbidden-request-header) and strips it regardless of origin or JavaScript. A cookie-type `apiKey` value typed into the panel will never reach the server. The field is still rendered (since the spec declares it) but an inline warning is shown to make the limitation visible.

### Fallback — manual token paste

Schemes that declare only flows the panel does not automate fall back to a plain masked input: paste an access token obtained elsewhere and it is sent as `Authorization: Bearer <token>`.

| Scheme | Reason for fallback |
|--------|---------------------|
| OAuth2 `implicit`-only | Deprecated flow — token returned in the URL fragment, no token-endpoint exchange |
| OAuth2 `password`-only | Deprecated flow — not implemented |
| `openIdConnect` | No automated sign-in implemented yet |

### Planned / not yet supported

| Feature | Notes |
|---------|-------|
| OAuth2 `implicit` flow | Deprecated by OAuth 2.1; low priority. Falls back to manual token paste. |
| OAuth2 `password` flow | Deprecated by OAuth 2.1; low priority. Falls back to manual token paste. |
| OpenID Connect automated sign-in | Would follow the same popup approach as `authorization_code`. |
| Token refresh | `refresh_token` from an `authorization_code` exchange is stored but not yet used to silently re-authorize on expiry. |
| PKCE `plain` challenge method | `S256` only for now; `plain` is deprecated in practice. |
| Cookie-based API key | `Cookie` is a forbidden Fetch header — cannot be sent from a browser panel without a same-origin proxy. |

## Scope (v1)

Supported: path/query/header/cookie parameters including `deepObject`-style and array-style (`form`/`spaceDelimited`/`pipeDelimited`, exploded or joined) query params; server variable substitution; a body editor that adapts to the declared content type — raw JSON/text, a `multipart/form-data` field table (text + file inputs, including repeated files under one field name for an array-of-binary property), or a single-file picker for a binary body (`application/octet-stream`, `image/*`, or any `format: binary` schema); response status/headers/body display alongside the operation's documented response codes; per-document credential/server-variable persistence in `sessionStorage`; export of the current request (as assembled, including entered credentials) as a Postman Collection v2.1, Insomnia v4 JSON, or HAR 1.2 file. File/multipart bytes aren't embedded — the export keeps field names and filenames, and the importer re-attaches files.

Not yet supported (tracked as follow-up work, not silently missing):
- AsyncAPI / WebSocket / Kafka / MQTT "try it" (this package only fills `openapi.operation.tab`).
- Schema-driven form generation for a JSON body (raw textarea only — multipart bodies do get a generated field table, see above).
- A hosted CORS-bypass proxy (only the `proxyUrl` escape hatch above).

## Development

```sh
npm install
npm run test       # vitest
npm run typecheck
npm run build
```

Manual QA against the apiuikit playground: see [TESTING.md](./TESTING.md).
