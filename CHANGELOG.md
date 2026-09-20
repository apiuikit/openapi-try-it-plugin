# @apiuikit/openapi-try-it-plugin

## 0.3.0

### Minor Changes

- bd7f9fa: Make the "Try it" panel usable on small screens. Below 768px the modal fills the viewport instead of sitting inside a 2rem inset, its request and response columns stack into a single scrolling column (same order as the tab layout, with `Send` sticky at the bottom), and the panel scrolls to the response once one arrives. Multipart body rows wrap rather than squeezing the value field, and all fields render at 16px on a narrow viewport so iOS Safari doesn't zoom in on focus. Layouts at 768px and above are unchanged.

## 0.2.1

### Patch Changes

- cee9376: Fix the "Try it" row's chrome (border, background) following the wrong palette when a host sets `theme.mode` (apiuikit ^1.9.0). `tryItRowStyle` previously guessed which of `theme.light`/`theme.dark` was active with `theme?.light ?? theme?.dark` — correct only for the old "light wins if both set" rule. It now reads `useDocumentContext().resolvedMode`, apiuikit's own answer, so the row stays visually consistent whenever `mode` picks dark (or `"system"` resolves to dark) while both palettes are configured. Requires apiuikit ^1.10.0 or later — the first version exposing `resolvedMode` (not 1.9.0, which shipped `theme.mode` itself but not this field).

## 0.2.0

### Minor Changes

- e68577c: Add `createTryItButtonPlugin`, a separate opt-in plugin that fills `openapi.operation.reference.supplementary` with a "Try it" button opening the request-sending panel in a modal. It does not register automatically alongside the existing `createTryItPlugin` tab — register either, both, or neither.

### Patch Changes

- e68577c: Fix `applyQueryParams` (and the auth-query-param step in `buildRequest`) percent-encoding an unresolved `{pathParam}` placeholder into `%7BpathParam%7D` any time the request URL was round-tripped through `new URL(...).toString()` — even with zero query params to add. The built request URL, used for export (Postman/Insomnia/HAR) and now shown live in the panel, stays readable instead.
