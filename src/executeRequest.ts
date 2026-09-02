import type { BuiltRequest, FetchOutcome } from "./types";

/** A cross-origin request blocked by CORS and a genuine network failure
 * (offline, DNS, refused connection) both surface to `fetch()` as the same
 * opaque `TypeError: Failed to fetch` / `NetworkError` — the browser never
 * tells JS which one happened. CORS is by far the more common cause for a
 * try-it-out panel calling a real API's origin directly (most private APIs
 * don't send permissive `Access-Control-Allow-Origin` headers), so this
 * plugin leads with that explanation but doesn't claim certainty. */
function isLikelyCorsFailure(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  return /failed to fetch|networkerror|load failed/i.test(error.message);
}

export interface ExecuteRequestOptions {
  proxyUrl?: string;
}

export async function executeRequest(request: BuiltRequest, options: ExecuteRequestOptions = {}): Promise<FetchOutcome> {
  const targetUrl = options.proxyUrl
    ? `${options.proxyUrl}${options.proxyUrl.includes("?") ? "&" : "?"}target=${encodeURIComponent(request.url)}`
    : request.url;

  const headers: Record<string, string> = {};
  for (const header of request.headers) headers[header.name] = header.value;

  const startedAt = performance.now();
  try {
    // `Cookie` is a forbidden header name (Fetch spec) — a browser silently
    // strips it however it's set, including via `headers` above, so the
    // Cookies table's typed-in values can never actually reach the request
    // that way. `credentials: "include"` would be the lever to make the
    // browser attach its real cookies for the target origin instead, but it
    // was tried and reverted: it makes credentialed CORS mandatory, so it
    // breaks the (far more common) wildcard-`Access-Control-Allow-Origin`
    // API that doesn't opt into credentialed CORS at all — trading a
    // working uncredentialed request for a cookie that still wouldn't be
    // sent (see the Cookies table's own warning). Left at fetch's default
    // ("same-origin"), which already sends real cookies for a genuinely
    // same-origin request (e.g. through a same-origin `proxyUrl`) with no
    // downside for the cross-origin case.
    const response = await fetch(targetUrl, {
      method: request.method.toUpperCase(),
      headers,
      body: request.body,
    });
    const body = await response.text();
    const durationMs = performance.now() - startedAt;

    return {
      kind: "success",
      result: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Array.from(response.headers.entries()),
        body,
        durationMs,
      },
    };
  } catch (error) {
    if (!options.proxyUrl && isLikelyCorsFailure(error)) {
      return {
        kind: "cors-error",
        message:
          "Request failed before a response came back — most likely blocked by the browser's CORS policy " +
          "because this API doesn't allow cross-origin requests from this page. Configure a proxyUrl on the " +
          "plugin to route requests through your own server, or test from a context the API does allow.",
      };
    }
    return { kind: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
