# TODO

What's left after v1 (path/query/header/cookie tables, deepObject + array-style query
params, server variables, API key/Bearer/Basic auth with masked/reveal secret inputs,
JSON body editor, response viewer, CORS-aware errors, session persistence — see README
for what's already shipped). Grouped by Scalar-parity gaps, edge cases found while
building v1, and repo infra.

## Scalar parity

Ordered roughly by how much of a real gap each one is against Scalar's Test Request panel.

- [x] **OAuth2 authorization_code flow** — `oauth2AuthorizationCode.ts` runs RFC 6749 §4.1:
      `buildAuthorizationUrl` constructs the provider login URL with a random `state`;
      `awaitAuthorizationCode` opens (in the caller) and polls a popup window until it
      navigates back to the registered `redirectUri` — reading `popup.location.href`
      throws while still cross-origin on the provider's pages, so polling that is the
      whole detection mechanism, no `postMessage` bridge or bundled callback page needed;
      `exchangeAuthorizationCode` then trades the code for a token (HTTP Basic per §2.3.1
      for a confidential client with a secret, `client_id` in the body per §2.1 for a
      public client without one). UI in `components/OAuth2AuthorizationCodeFields.tsx`
      (Authorization/Token URL display, Client ID, optional Client Secret via
      `SecretInput`, editable Redirect URI defaulting to the current page, a scope
      checklist + Select/Clear all, an Authorize/Re-authorize button), wired from
      `AuthPanel.tsx` whenever a scheme's `flows.authorizationCode` is present — the
      manual-token fallback now only covers `implicit`/`password`-only schemes. Requires
      the redirect URI to be same-origin with the embedding page (documented in the
      README) since same-origin readability of the popup's URL is the detection signal;
      no PKCE yet (still tracked below).
- [x] **OAuth2 client_credentials flow** — `oauth2ClientCredentials.ts` runs the real RFC
      6749 §4.4 grant (HTTP Basic client auth per §2.3.1, `grant_type=client_credentials`,
      optional `scope`) against `flows.clientCredentials.tokenUrl`; the resulting access
      token is applied as a real `Authorization` header (`requestBuilder.ts`'s
      `applyOneScheme`, gated by a new `isOAuth2TokenExpired` check against
      `obtainedAt`/`expires_in`). UI in `components/OAuth2ClientCredentialsFields.tsx`
      (Token URL, masked Client ID/Secret via `SecretInput`, a scope checklist + Select/
      Clear all, an Authorize/Re-authorize button with live error display), wired from
      `AuthPanel.tsx` whenever a scheme's `flows.clientCredentials` is present — taking
      priority over the manual-token fallback for that scheme. Verified live against the
      playground's "Unrealistic Torture Test (OpenAPI)" fixture, including the real
      network attempt to a fake token URL failing gracefully ("Failed to fetch", panel not
      stuck in a loading state).
- [x] **PKCE** (SHA-256 code challenge/verifier) for the authorization_code flow, matching
      Scalar's "Use PKCE" toggle. `oauth2AuthorizationCode.ts`'s `generateCodeVerifier`
      (RFC 7636 §4.1 — 32 random bytes, base64url) and `generateCodeChallenge` (§4.2's
      `S256` transform, `crypto.subtle.digest`) feed `code_challenge`/
      `code_challenge_method=S256` into `buildAuthorizationUrl` and `code_verifier` into
      `exchangeAuthorizationCode`; verified against RFC 7636 Appendix B's worked example
      in `oauth2AuthorizationCode.test.ts`. A "Use PKCE" checkbox in
      `OAuth2AuthorizationCodeFields.tsx` defaults to on (`plain` challenge method not
      supported, only `S256`).
- [x] **OAuth2 scope selection UI** — per-scope checkboxes + Select all/Clear all, seeded
      from the security requirement's declared scopes. Shipped as part of both
      `OAuth2ClientCredentialsFields.tsx` and `OAuth2AuthorizationCodeFields.tsx` above,
      not as a separate change.
- [x] **Secret masking** — apiKey/Bearer/manual-token inputs and the Basic-auth password
      are masked (`SecretInput.tsx`) with a Show/Hide reveal toggle, like Scalar's Client
      Secret field. (OAuth client secret itself still N/A until the client_credentials/
      authorization_code flows below exist.)
- [x] **Array-style query params** beyond `deepObject` — `style: form`/`spaceDelimited`/
      `pipeDelimited` with `explode: true/false` now serialize correctly
      (`applyQueryParams` in `requestBuilder.ts`, rows built in `paramRows.ts`, UI in
      `ParamsTable.tsx`). Plain repeated-key vs. comma-joined is covered by `explode`;
      no separate "plain multi-value" case was needed.
- [ ] **Array-typed deepObject sub-fields** — Scalar's `filters[roles]` example is an array,
      not a scalar. `ParamsTable`'s deep-object sub-table only supports one value per key.
- [x] **multipart/form-data and binary bodies** — `bodyMedia.ts`'s `resolveRequestBodyMedia`
      now returns a `mode` (`text`/`multipart`/`binary`), detected from the content type
      (`multipart/form-data`) or the schema (`type: string, format: binary` — including the
      OpenAPI 3.1/JSON Schema 2020-12 nullable form, `type: ["string", "null"]`), with a
      content-type heuristic (`application/octet-stream`, `application/pdf`, `image/*`,
      etc.) for a binary body with no schema at all. `bodyFields.ts`'s
      `buildMultipartFieldRows` turns a multipart body's object schema into one row per
      property — a file picker for a binary (or array-of-binary, for repeated files under
      one field name) property, a text input otherwise — rendered by the new
      `MultipartBodyEditor.tsx` (with an "+ Add" for extra fields, like the param tables).
      A single-file body gets the new `BinaryBodyEditor.tsx` instead. `requestBuilder.ts`'s
      `buildRequest` assembles a `FormData` for multipart (no manual `Content-Type` — fetch
      derives the boundary from the `FormData` body itself) or sends the selected `File`
      directly with the declared `Content-Type` for binary. Verified live against the
      playground's "Unrealistic Torture Test (OpenAPI)" `POST /files` fixture (a required
      `file` field, a nullable `thumbnail` field, a `metadata` $ref, and a `tags` array),
      including uploading a real file and sending — failed gracefully against the fixture's
      fake domain, same as the OAuth2 flows' verification.
- [ ] **Schema-driven body form** as an alternative to raw JSON (toggle between "Form" and
      "Raw JSON"), generated from `requestBody.content[type].schema`.
- [ ] **"Show Schema" toggle in the response viewer** — Scalar's response panel switches
      between the live/example body and its JSON Schema. `ResponseViewer.tsx` only shows
      status-code badges today, not the documented schema itself.
- [ ] **Per-status-code example preview** — clicking an undocumented-but-listed code (e.g.
      `429` when the live response was `401`) should show that code's documented example,
      not just highlight the badge.
- [ ] **Content-type-aware response rendering** — pretty-print/syntax-highlight XML and
      other non-JSON bodies instead of a plain `<pre>` dump.
- [ ] **Export to Postman/Insomnia/HAR** ("Open API Client" in Scalar's screenshot).
- [ ] **User-defined environments** — custom base URLs on top of the spec's declared
      `servers`, not just variable substitution within them.
- [ ] **AsyncAPI try-it** — `asyncapi.operation.tab` is registered by apiuikit but this
      package only fills the OpenAPI HTTP slot. No WS/Kafka/MQTT execution recipe exists
      yet anywhere in the ecosystem (see apiuikit's plugins.md).

## Edge cases found while building v1

- [x] `isDeepObject`/`deepObjectKeys`/`isArrayParam`/`arrayExampleValues`/`exampleValue`
      (`paramRows.ts`) now resolve a `param.schema` that's an unresolved `{ $ref }` node
      (apiuikit's circular-reference back-edge convention) via `useDocumentContext().deref`,
      threaded down from `TryItPanel.tsx` as `Deref` (`types.ts`), instead of silently
      reading `undefined` off the `$ref` node and rendering an empty sub-table.
- [x] Confirmed the Cookies table's typed-in values can't actually be sent — worse than
      the original cross-origin framing: `Cookie` is a Fetch-spec *forbidden header*, so a
      browser strips it regardless of origin. Tried making cookies work for real via
      `credentials: "include"` in `executeRequest.ts`; reverted after live testing showed
      it makes credentialed CORS mandatory, breaking the far more common
      wildcard-`Access-Control-Allow-Origin` API in exchange for a cookie that still
      wouldn't send. Landed on: fetch's default (`"same-origin"`, unchanged) already
      sends real cookies for a genuinely same-origin request (e.g. a same-origin
      `proxyUrl`) with no downside, plus an inline warning (`ParamsTable`'s new `warning`
      prop, and a matching note on `apiKey`-in-cookie auth in `AuthPanel.tsx`) so the
      limitation is visible in the panel, not just the README.
- [x] `applyQueryParams` (`requestBuilder.ts`) now collapses duplicate enabled
      `deepObject` entry keys to the last one before serializing (a query string can't
      express "override", so sending both was always ambiguous), and `ParamsTable.tsx`
      shows an inline "Duplicate key — only the last enabled value is sent" hint so the
      collapse isn't silent.

## Repo infra

- [ ] CI (GitHub Actions): lint + typecheck + test + build on every push/PR — nothing runs
      automatically today.
- [ ] Component tests (React Testing Library) for `TryItPanel`, `AuthPanel`, `ParamsTable`,
      `ResponseViewer` — today only `requestBuilder.ts`/`paramRows.ts` have unit tests, the
      UI layer is untested.
- [ ] Dark-mode visual pass — only verified in light theme against the playground so far.
- [ ] Accessibility pass — `aria-live` region for response updates after Send, keyboard
      navigation through the param tables.
- [ ] **Publish blocker**: apiuikit's `apiuikit/plugin` entry point (the whole plugin
      system) hasn't shipped in a released npm version yet — published `apiuikit` is
      `1.5.3` and has no `/plugin` export. This package can't be installed for real by
      anyone outside this monorepo checkout until that lands; `devDependencies.apiuikit`
      currently points at a local `file:` path for exactly this reason.
