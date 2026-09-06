# @apiuikit/openapi-try-it-plugin

## 0.2.0

### Minor Changes

- e68577c: Add `createTryItButtonPlugin`, a separate opt-in plugin that fills `openapi.operation.reference.supplementary` with a "Try it" button opening the request-sending panel in a modal. It does not register automatically alongside the existing `createTryItPlugin` tab — register either, both, or neither.

### Patch Changes

- e68577c: Fix `applyQueryParams` (and the auth-query-param step in `buildRequest`) percent-encoding an unresolved `{pathParam}` placeholder into `%7BpathParam%7D` any time the request URL was round-tripped through `new URL(...).toString()` — even with zero query params to add. The built request URL, used for export (Postman/Insomnia/HAR) and now shown live in the panel, stays readable instead.
