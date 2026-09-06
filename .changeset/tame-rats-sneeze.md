---
"@apiuikit/openapi-try-it-plugin": patch
---

Fix `applyQueryParams` (and the auth-query-param step in `buildRequest`) percent-encoding an unresolved `{pathParam}` placeholder into `%7BpathParam%7D` any time the request URL was round-tripped through `new URL(...).toString()` — even with zero query params to add. The built request URL, used for export (Postman/Insomnia/HAR) and now shown live in the panel, stays readable instead.
