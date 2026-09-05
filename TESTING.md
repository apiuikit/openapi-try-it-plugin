# Manual test plan

Maintainer checklist for exercising every case this plugin's Try It panel supports, by
hand. This repo has no demo app — dogfood against the sibling [apiuikit](https://github.com/AceTheCreator/apiuikit)
playground. Nothing here runs in CI; this is the "before you call it done" pass.

Requests against `auth.example.com`, `api.example.com`, etc. will always fail (fake
domains, no DNS) — that's expected. The thing to verify in those cases is that the
panel fails **gracefully** (a clear error message, not a stuck spinner or a blank
crash), not that the request actually succeeds. A handful of cases do need a real
endpoint to see all the way through — those are called out explicitly.

## Setup

Clone `apiuikit` next to this repo (so `../apiuikit` is the playground host):

```sh
cd ../apiuikit                     # apiuikit repo root, not this repo
npm install                        # from the root — NOT --prefix packages/playground,
                                   # which breaks the workspace symlink and pulls the
                                   # published `apiuikit` package instead of the local
                                   # packages/lib build
npm run dev --prefix packages/playground
```

The playground loads this plugin via `packages/playground/src/plugins/tryItPlugin.ts`
(local-only; not committed). Open `http://localhost:5173`, click **Edit** (top right),
click the document-URL field, type `torture`, and pick **Unrealistic Torture Test
(OpenAPI)** — that's the fixture most cases below reference. Click **Preview**, find
the operation, click **Try it**.

A few cases need a security scheme or field shape the bundled fixtures don't happen to
wire up to any operation (noted inline as **ad hoc**). For those, use the editor's
**Edit** view to paste in a minimal edit — it's a live text editor, changes apply
immediately, no save/reload needed.

### OAuth2 real pass-through

Public providers (GitHub, etc.) often block the browser token exchange with CORS, so
you can't finish Authorize from the Try it panel against them. Use one of the options
below for a full end-to-end pass of the two flows this plugin automates —
`authorization_code` (+ PKCE) and `client_credentials`.

**Note:** if a scheme declares *both* `clientCredentials` and `authorizationCode`, the
panel prefers `client_credentials`. Use a scheme that declares only the flow you want.

Start the playground (Setup above), open **Edit**, paste one of the specs below
(replace the whole document), click **Preview**, open the operation, **Try it**.

#### Option 1 — Duende IdentityServer demo (public, preferred)

[Duende's public demo IdP](https://demo.duendesoftware.com/) allows any browser
origin on `/connect/token` and accepts arbitrary redirect URIs (demo-only). No local
OAuth server, no app registration. Protected resource: `GET /api/test`.

| Flow | Client ID | Client Secret | Scopes |
|------|-----------|---------------|--------|
| `client_credentials` | `m2m` | `secret` | `api` |
| `authorization_code` (+ PKCE) | `interactive.public` | *(leave blank)* | `openid`, `profile`, `api` |

Interactive login users: `alice` / `alice` or `bob` / `bob`.

##### Spec A — `authorization_code` (+ PKCE) via Duende

```yaml
openapi: 3.0.3
info:
  title: Duende OAuth2 Authorization Code
  version: 1.0.0

servers:
  - url: https://demo.duendesoftware.com

paths:
  /api/test:
    get:
      operationId: getTest
      summary: Demo protected API
      security:
        - DuendeInteractive:
            - openid
            - profile
            - api
      responses:
        "200":
          description: OK

components:
  securitySchemes:
    DuendeInteractive:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://demo.duendesoftware.com/connect/authorize
          tokenUrl: https://demo.duendesoftware.com/connect/token
          scopes:
            openid: OpenID
            profile: Profile
            api: Demo API
```

1. Client ID: `interactive.public`. Leave Client Secret blank (public client).
2. Redirect URI: leave the panel default (`http://localhost:5173/` or whatever the
   playground page is) — must be same-origin with the page. Duende's demo accepts it.
3. Keep **Use PKCE** checked (this client requires PKCE). Optionally run once with
   PKCE off against a different client if you need that path — use Option 2 below.
4. Click **Authorize** — login popup (`alice` / `alice`), token lands, then **Send**
   `GET /api/test`.

##### Spec B — `client_credentials` via Duende

```yaml
openapi: 3.0.3
info:
  title: Duende OAuth2 Client Credentials
  version: 1.0.0

servers:
  - url: https://demo.duendesoftware.com

paths:
  /api/test:
    get:
      operationId: getTest
      summary: Demo protected API
      security:
        - DuendeM2M:
            - api
      responses:
        "200":
          description: OK

components:
  securitySchemes:
    DuendeM2M:
      type: oauth2
      flows:
        clientCredentials:
          tokenUrl: https://demo.duendesoftware.com/connect/token
          scopes:
            api: Demo API
```

1. Client ID `m2m`, Client Secret `secret`, scope `api`.
2. Click **Authorize** — no popup; token request hits `/connect/token` directly.
3. Confirm "Authorized — expires in …", then **Send** `GET /api/test`.

#### Option 2 — Local `oauth2-mock-server` (offline / no third-party dependency)

When Duende is down, you want offline testing, or you need a client that allows
auth-code **without** PKCE, run a local mock in a second terminal:

```sh
npx oauth2-mock-server
```

It listens on `http://localhost:8080` by default (`/authorize`, `/token`, `/userinfo`, …).
Leave it running, then paste Spec C or Spec D below.

##### Spec C — `authorization_code` (+ PKCE) via local mock

```yaml
openapi: 3.0.3
info:
  title: OAuth2 Auth Code Mock Test
  version: 1.0.0

servers:
  - url: http://localhost:8080

paths:
  /userinfo:
    get:
      operationId: getUserInfo
      summary: Get user info (protected)
      security:
        - MockOAuth:
            - openid
      responses:
        "200":
          description: OK

components:
  securitySchemes:
    MockOAuth:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: http://localhost:8080/authorize
          tokenUrl: http://localhost:8080/token
          scopes:
            openid: OpenID Connect
            profile: User profile
```

1. Client ID / Secret: any strings (e.g. `test-client` / `test-secret`), or leave Secret
   blank to exercise the public-client path.
2. Redirect URI: leave the panel default — must be same-origin with the page.
3. Run once with **Use PKCE** checked, once unchecked.
4. Click **Authorize** — popup should complete, token lands, then **Send** `GET /userinfo`.

##### Spec D — `client_credentials` via local mock

```yaml
openapi: 3.0.3
info:
  title: OAuth2 Client Credentials Mock Test
  version: 1.0.0

servers:
  - url: http://localhost:8080

paths:
  /userinfo:
    get:
      operationId: getUserInfo
      summary: Get user info (protected)
      security:
        - MockOAuth: []
      responses:
        "200":
          description: OK

components:
  securitySchemes:
    MockOAuth:
      type: oauth2
      flows:
        clientCredentials:
          tokenUrl: http://localhost:8080/token
          scopes:
            openid: OpenID Connect
            profile: User profile
```

1. Client ID / Secret: any strings.
2. Click **Authorize** — no popup; token request hits `/token` directly.
3. Confirm "Authorized — expires in …", then **Send** `GET /userinfo`.

---

## 1. Authentication

### API key

- [ ] **Header** (`GET /users/{userId}` — inherits the document-level `ApiKey` OR requirement): type a value into the field, send, confirm it goes out as `X-API-Key` (check the request in your browser's devtools Network tab, or a local echo server via `proxyUrl` if you want to see it land).
- [ ] Value is masked by default with a **Show/Hide** toggle.
- [ ] **Cookie** (**ad hoc** — no bundled fixture declares a cookie-type `apiKey` scheme; add one in the editor: `type: apiKey, in: cookie, name: session` on some operation's `security`): confirm the inline warning about the browser blocking script-set `Cookie` headers appears, and that sending doesn't error out.
- [ ] **Query** (**ad hoc**, `in: query`): confirm the value is appended as a query param on the sent URL.

### HTTP Bearer / Basic

- [ ] **Bearer** (**ad hoc** — `BearerAuth` is declared in the torture fixture's `components.securitySchemes` but no operation references it; add `security: [{BearerAuth: []}]` to any operation, or use a fixture that already wires up bearer auth, e.g. paste a minimal spec): token field is masked with Show/Hide; sent as `Authorization: Bearer <token>`.
- [ ] **Basic** (**ad hoc**, same as above with `BasicAuth`): separate username + masked-password fields; sent as `Authorization: Basic <base64(user:pass)>`.

### OAuth2 `client_credentials`

Use `POST /orders` (`orders:write` scope) or any operation under the torture fixture's
`OAuth2` scheme.

- [ ] Token URL shown read-only, matches the spec's `flows.clientCredentials.tokenUrl`.
- [ ] Client ID + masked Client Secret fields.
- [ ] Scope checklist pre-checks scopes the operation's security requirement actually asks for; **Select all** / **Clear all** toggle correctly.
- [ ] Click **Authorize** with empty Client ID/Secret — button stays disabled.
- [ ] Fill Client ID/Secret, click **Authorize** — button shows "Authorizing…", then fails gracefully (fake token URL) with the error message shown inline, not a silently stuck button.
- [ ] **For a real pass-through**: use **Spec B** (Duende) under [OAuth2 real pass-through](#oauth2-real-pass-through) — or **Spec D** (local mock) if offline — authorize for real, confirm "Authorized — expires in Nm" appears and the Authorization header on Send carries the real token.
- [ ] Re-authorize after a token is already set — button label changes to "Re-authorize".

### OAuth2 `authorization_code`

Use **Spec A** (Duende) under [OAuth2 real pass-through](#oauth2-real-pass-through),
or **Spec C** (local mock) if offline / for PKCE-off. The torture fixture's `OAuth2`
scheme also declares `clientCredentials`, which the panel prefers — so that fixture
never shows the authorization_code UI.

- [ ] Authorization URL + Token URL shown read-only.
- [ ] Client ID, optional masked Client Secret (placeholder notes "leave blank for a public client"), editable Redirect URI **pre-filled with the current page URL**.
- [ ] **Use PKCE** checkbox, checked by default.
- [ ] Scope checklist, same pre-check/Select-all/Clear-all behavior as client_credentials.
- [ ] Click **Authorize** with Client ID filled — a popup window opens (not blocked). If your browser/OS blocks it, confirm the panel shows "Popup blocked — allow popups for this site and try again," not a silent no-op.
- [ ] **Close the popup manually before it completes** — panel recovers with "Authorization was cancelled…", button re-enables (doesn't stay stuck on "Authorizing…").
- [ ] **For a real pass-through**: use **Spec A** (Duende, PKCE on) under [OAuth2 real pass-through](#oauth2-real-pass-through) — Authorize, confirm the popup closes and a token lands. For **PKCE off**, use **Spec C** (local mock).
- [ ] Same real pass-through **with an empty Client Secret** (public client) — Spec A already does this (`interactive.public`); or Spec C with Secret blank — confirm the token exchange still succeeds (no Basic auth header sent, `client_id` goes in the body instead — check via devtools or a proxy).
- [ ] Token expiry / re-authorize behaves the same as client_credentials above.

### Multiple / combined security requirements

- [ ] `GET /users/{userId}` (document-level `security: [{OAuth2: [users:read]}, {ApiKey: []}]`, an OR) — confirm a dropdown appears letting you pick which alternative to use, and that switching it swaps which fields render below.
- [ ] **ad hoc AND requirement** (a single requirement object naming two schemes, e.g. `security: [{ApiKey: [], BearerAuth: []}]`): confirm *both* schemes' fields render together under one alternative, and both credentials get applied on Send.
- [ ] **ad hoc** — every operation in the torture fixture either inherits the document-level OR requirement or declares its own; add `security: []` to any operation to opt it out explicitly, confirm the Authorization section doesn't render at all for it.

---

## 2. Request body

### JSON (the default/common case)

- [ ] `POST /users` — body pre-fills from the spec's example (if any) or an empty object; edit it, send.
- [ ] Type invalid JSON (e.g. a trailing comma or unbalanced brace), click Send — "Invalid JSON body: …" error shown inline, request is **not** sent (check Network tab / proxy — no request should fire).
- [ ] Fix the JSON, send again — error clears, request goes out with `Content-Type: application/json`.
- [ ] `GET` operations show no body editor at all.

### multipart/form-data — `POST /files`

- [ ] Body section header reads "Body (multipart/form-data)".
- [ ] `file` row: checkbox pre-checked (required), file picker (not a text input).
- [ ] `thumbnail` row: checkbox **unchecked** (optional, nullable `type: [string, null]` — confirm this still renders as a file picker, not a text box, since it's still `format: binary` under the hood).
- [ ] `metadata` row ($ref to an object schema): text input, placeholder "required", pre-checked.
- [ ] `tags` row (array of plain strings): text input, unchecked.
- [ ] Upload a real file to `file`, type `{"description":"test"}` into `metadata`, leave `thumbnail`/`tags` unchecked, click Send — confirm (via a proxy/echo server, or just that it fails gracefully against the fake domain) **no** `Content-Type` header was set manually (the browser must supply its own `multipart/form-data; boundary=…`).
- [ ] Uncheck `file` (the required one) and Send with only optional fields filled — confirm the panel still sends (no client-side "required" blocking) and that the resulting FormData just omits `file`.
- [ ] Click **+ Add**, type a custom field name, use the Text/File dropdown to switch it to File, upload a file under a name not in the spec — confirm it's included.
- [ ] Remove a custom row with the **×** button.
- [ ] **ad hoc array-of-files**: add a property `items: {type: array, items: {type: string, format: binary}}` to the schema, select **multiple** files in that row's picker, send — confirm (via proxy/echo) all files go out under the same field name as separate parts.

### binary body (single file)

- [ ] **ad hoc** — no bundled fixture has a standalone (non-multipart) binary request body; add one, e.g. `content: {image/png: {schema: {type: string, format: binary}}}` on some operation. Confirm the panel shows a single file picker labeled "Body (image/png)", not the multipart table or the JSON textarea.
- [ ] Select a file — filename + size shown below the picker.
- [ ] If the selected file's own MIME type differs from the declared content type (e.g. pick a `.txt` file for a schema declared `image/png`), confirm the hint notes "(sent as image/png, browser reports text/plain)".
- [ ] Click **Clear** — file cleared, hint disappears.
- [ ] Send with a file selected — confirm (proxy/echo, or graceful failure) the request's `Content-Type` is the **declared** type, not the file's own, and the body is the raw file bytes (not wrapped in FormData).
- [ ] Also try the content-type-heuristic path: same as above but with **no** `schema` at all under `application/octet-stream` — should still classify as binary.

---

## 3. Parameters

Use `GET /users/{userId}` and `GET /search` in the torture fixture.

- [ ] **Path** (`userId`): typing a value with a space or slash gets percent-encoded in the sent URL; leaving it blank keeps the literal `{userId}` token in the URL rather than sending `%7BuserId%7D`.
- [ ] **Simple query** (`GET /search`'s `coordinates`, or similar): enable/disable checkbox controls whether it's sent; empty value is omitted even if enabled.
- [ ] **deepObject query** (`GET /users/{userId}`'s `filters`, or `/search`'s `matrix`): sub-table of key/value rows; sends as `filters[key]=value`.
- [ ] Two enabled sub-rows with the **same key** — inline "Duplicate key — only the last enabled value is sent" hint appears, and only the last one's value actually goes out.
- [ ] **Array query, non-exploded** `form` (`GET /users/{userId}`'s `include`, `style: form, explode: false`): values joined with a comma in one param.
- [ ] **ad hoc**: an exploded array (`explode: true`) — repeated `name=value` pairs instead.
- [ ] **ad hoc**: `spaceDelimited` / `pipeDelimited` styles — joined with a space / `|` respectively when not exploded.
- [ ] `GET /search`'s `matrix` deepObject param is declared via `additionalProperties` rather than fixed `properties` — confirm its sub-table starts with **zero** pre-seeded rows (only `properties`-declared keys are pre-seeded), but that **+ field** still lets you add a row by hand and send it.
- [ ] **Header**: `accept` row is pre-populated from the operation's documented response content types and pre-enabled; add a custom header via **+ Add**.
- [ ] **Cookie** (`GET /search`'s `preferences`): the table-wide warning about browsers blocking script-set `Cookie` headers is visible above the rows.
- [ ] `X-Debug-Mode` / `X-Experimental` headers with a `const` schema value — confirm they still just behave like ordinary editable rows (no special "locked to the const value" UI — that's fine, just confirm no crash).

---

## 4. Servers

`GET /users/{userId}` or any operation — the torture fixture declares two servers.

- [ ] Server dropdown lists both (`https://{region}.api.example.com/{version} — Production` and `http://localhost:{port} — Local development`).
- [ ] Switching servers re-seeds the variable inputs below from the newly selected server's declared defaults.
- [ ] `{region}` has a declared `enum` (`us-east-1`/`eu-west-1`/`ap-south-1`) but renders as a **free-text input**, not a dropdown — pre-filled with the default; typing any string (in or out of the enum) is accepted, confirming this is intentionally unvalidated free text.
- [ ] `{version}`, `{port}` — same free-text substitution; confirm the sent URL reflects whatever you typed.

---

## 5. Response viewer

- [ ] Any request against the fake `auth.example.com` / `api.example.com` domains — confirm the CORS/network-failure message appears (not a stuck "Sending…" state), and it correctly notes `proxyUrl` as the escape hatch.
- [ ] Status badges for the operation's **documented** response codes (e.g. `POST /files`'s `201`/`413`) render above the response body regardless of what the live request returned.
- [ ] **With a real reachable endpoint** (point at any real API, or a local echo server): confirm status/headers/body of the actual response render correctly, and the matching documented-status badge is visually distinguished.

---

## 6. Persistence

- [ ] Fill in a credential (e.g. an API key) and a server variable, reload the page (`F5`), re-open the same operation — both are restored.
- [ ] Switch to a **different** loaded document (a different fixture), confirm its credentials are independent (not leaked from the previous document).
- [ ] Open the same document in a new **tab** — sessionStorage is per-tab, so confirm the new tab starts blank (this is by design, not a bug — see `storage.ts`'s doc comment).

---

## 7. Proxy (`proxyUrl`)

This needs `packages/playground/src/plugins/tryItPlugin.ts` (or wherever the plugin is
registered) temporarily changed to `createTryItPlugin({ proxyUrl: "http://localhost:PORT" })`
pointed at a local echo/proxy server you control.

- [ ] With `proxyUrl` set, confirm requests go to `${proxyUrl}?target=<url-encoded target URL>` instead of hitting the API origin directly — this is the one case where you can actually inspect the real assembled request (headers, multipart boundary, binary bytes) end to end.
- [ ] Same-origin cookies (typed into the Cookies table are never sent, per the table's warning) — but confirm a genuinely same-origin proxy request **does** carry the browser's real cookies for that origin automatically.

---

## 8. Export (Postman / Insomnia / HAR)

Use any operation with a filled-in request (e.g. `POST /users` in the torture
fixture, with a path/query value and a JSON body). Export is next to **Send**.

- [ ] **Export** button sits next to Send; clicking it opens a menu with Postman Collection, Insomnia, and HAR.
- [ ] Each option downloads a file named from the method + path (e.g. `post-users.postman_collection.json`, `post-users.insomnia.json`, `post-users.har`) — not a generic `download.json`.
- [ ] Open the Postman file: Collection v2.1, one request, URL/headers/body match what Send would send (typed-in values, not spec placeholders). Import it in Postman (File → Import) if you have it.
- [ ] Open the Insomnia file: `__export_format` is `4`, one workspace + one request. Import it in Insomnia if you have it.
- [ ] Open the HAR file: `log.version` is `1.2`, one entry. Query params appear both on `url` and in `queryString`. After a successful Send, a second HAR export includes that response (status/body); before any Send, response `status` is `0`.
- [ ] Enter a Bearer token (or API key), export, confirm the credential is in the file (Authorization header / apiKey location) — this is intentional, called out on the button tooltip.
- [ ] `POST /files` with a real file selected — export lists the field name and filename, not the file bytes. The downloaded JSON should not balloon to the file's size.
- [ ] Click outside the menu or press Escape — menu closes.
- [ ] Invalid JSON in the body editor still exports (unlike Send, which blocks) — the raw text goes into the file as-is.

---

## Regression sweep (do this after any change, not just once)

- [ ] Switch between two different operations in the same document — every table (params, auth, body) resets to the new operation's own state, nothing bleeds over from the previous one.
- [ ] Switch tabs (Reference → Try it → Reference → Try it) on the same operation — no duplicate state, no stale error messages left over from a previous Send.
- [ ] Browser devtools console stays free of uncaught errors/warnings from this plugin's own code throughout a full pass (pre-existing apiuikit-internal warnings, if any, aren't this plugin's concern).
- [ ] `npm run test`, `npm run typecheck`, `npm run build`, `npx eslint src` all clean.
