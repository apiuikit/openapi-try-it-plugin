import { randomId } from "./randomId";

export interface AuthorizationCodeTokenResult {
  accessToken: string;
  tokenType?: string;
  expiresInSeconds?: number;
  refreshToken?: string;
}

export type AuthorizationCodeTokenOutcome =
  | { kind: "success"; result: AuthorizationCodeTokenResult }
  | { kind: "error"; message: string };

export type AuthorizationCodeCallbackOutcome = { kind: "success"; code: string } | { kind: "error"; message: string };

function readErrorMessage(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    // RFC 6749 §5.2 error response shape.
    if (typeof record.error_description === "string") return record.error_description;
    if (typeof record.error === "string") return record.error;
  }
  return `Token request failed with ${status} ${statusText}`;
}

export interface BuildAuthorizationUrlInput {
  authorizationUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  /** RFC 7636 §4.3 `S256` code challenge — set together with
   * `code_challenge_method=S256` when PKCE is enabled for this flow. */
  pkceCodeChallenge?: string;
}

/** Builds the provider login URL for RFC 6749 §4.1.1 — `response_type=code`
 * plus a caller-supplied `state` the callback is later checked against, so a
 * response that isn't actually a reply to *this* authorize call (e.g. a
 * stale popup, or a forged redirect) is rejected rather than silently
 * accepted. */
export function buildAuthorizationUrl(input: BuildAuthorizationUrlInput): string {
  const url = new URL(input.authorizationUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  if (input.scopes.length > 0) url.searchParams.set("scope", input.scopes.join(" "));
  if (input.pkceCodeChallenge) {
    url.searchParams.set("code_challenge", input.pkceCodeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

/** Random enough for CSRF purposes (not a security token itself). */
export function generateState(): string {
  return randomId();
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 7636 §4.1: 43-128 characters from the unreserved character set.
 * 32 random bytes, base64url-encoded, comes out to exactly 43 — the
 * shortest valid verifier. */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** RFC 7636 §4.2's `S256` transform: `BASE64URL(SHA256(verifier))`. Scalar's
 * "Use PKCE" toggle runs the same transform — this plugin only supports
 * `S256`, not the (deprecated-in-practice) `plain` method. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export interface AwaitAuthorizationCodeInput {
  /** Already-opened popup window (opened synchronously in the click handler
   * that triggered this flow, before any `await` — otherwise most browsers'
   * popup blockers discard it). */
  popup: Window;
  redirectUri: string;
  state: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

/** Polls a popup window for navigation back to `redirectUri`. The popup
 * starts cross-origin (the provider's login page), so `popup.location.href`
 * throws until it navigates somewhere same-origin with this page — which
 * only happens once the provider redirects back. That's the whole
 * mechanism: no `postMessage` bridge or bundled callback page needed, as
 * long as `redirectUri` really is same-origin with the app (a same-origin
 * requirement this flow can't relax — a cross-origin redirect target would
 * never become readable). */
export function awaitAuthorizationCode(input: AwaitAuthorizationCodeInput): Promise<AuthorizationCodeCallbackOutcome> {
  const pollIntervalMs = input.pollIntervalMs ?? 250;
  const timeoutMs = input.timeoutMs ?? 5 * 60 * 1000;
  const redirectTarget = new URL(input.redirectUri);

  return new Promise((resolve) => {
    const startedAt = Date.now();

    function finish(outcome: AuthorizationCodeCallbackOutcome) {
      clearInterval(interval);
      if (!input.popup.closed) input.popup.close();
      resolve(outcome);
    }

    const interval = setInterval(() => {
      if (input.popup.closed) {
        clearInterval(interval);
        resolve({ kind: "error", message: "Authorization was cancelled — the popup was closed before completing." });
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        finish({ kind: "error", message: "Authorization timed out." });
        return;
      }

      let href: string;
      try {
        href = input.popup.location.href;
      } catch {
        // Still cross-origin, i.e. still on the provider's pages. Keep polling.
        return;
      }
      if (!href || href === "about:blank") return;

      let landedUrl: URL;
      try {
        landedUrl = new URL(href);
      } catch {
        return;
      }
      // Same-origin doesn't necessarily mean "done" — a provider's own login
      // subpages could coincidentally share an origin. Only treat this as
      // the callback once the path matches the redirect URI we registered.
      if (landedUrl.origin !== redirectTarget.origin || landedUrl.pathname !== redirectTarget.pathname) return;

      const error = landedUrl.searchParams.get("error");
      if (error) {
        const description = landedUrl.searchParams.get("error_description");
        finish({ kind: "error", message: description ?? error });
        return;
      }

      const returnedState = landedUrl.searchParams.get("state");
      if (returnedState !== input.state) {
        finish({ kind: "error", message: "Authorization response state didn't match the request — discarding (possible CSRF)." });
        return;
      }

      const code = landedUrl.searchParams.get("code");
      if (!code) {
        finish({ kind: "error", message: "Authorization response didn't include a code." });
        return;
      }

      finish({ kind: "success", code });
    }, pollIntervalMs);
  });
}

export interface ExchangeAuthorizationCodeInput {
  tokenUrl: string;
  code: string;
  redirectUri: string;
  clientId: string;
  /** Empty for a public client (RFC 6749 §2.1) — `client_id` goes in the
   * body instead of a Basic auth header, since there's no secret to
   * authenticate with. */
  clientSecret: string;
  /** RFC 7636 §4.5 — the verifier behind this authorize call's
   * `code_challenge`, sent so the token endpoint can recompute and check it. */
  codeVerifier?: string;
}

/** Runs RFC 6749 §4.1.3's token exchange: trade the authorization code for
 * an access token. Confidential clients (non-empty `clientSecret`)
 * authenticate via HTTP Basic per §2.3.1, mirroring the client_credentials
 * grant's `fetchClientCredentialsToken`; public clients send `client_id` in
 * the body instead, since they have no secret to authenticate with. */
export async function exchangeAuthorizationCode(input: ExchangeAuthorizationCodeInput): Promise<AuthorizationCodeTokenOutcome> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
  });
  if (input.codeVerifier) body.set("code_verifier", input.codeVerifier);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (input.clientSecret) {
    headers.Authorization = `Basic ${btoa(`${encodeURIComponent(input.clientId)}:${encodeURIComponent(input.clientSecret)}`)}`;
  } else {
    body.set("client_id", input.clientId);
  }

  try {
    const response = await fetch(input.tokenUrl, { method: "POST", headers, body: body.toString() });

    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }

    if (!response.ok) {
      return { kind: "error", message: readErrorMessage(response.status, response.statusText, json) };
    }
    if (!json || typeof json !== "object" || typeof (json as Record<string, unknown>).access_token !== "string") {
      return { kind: "error", message: "Token response didn't include an access_token." };
    }

    const parsed = json as Record<string, unknown>;
    return {
      kind: "success",
      result: {
        accessToken: parsed.access_token as string,
        tokenType: typeof parsed.token_type === "string" ? parsed.token_type : undefined,
        expiresInSeconds: typeof parsed.expires_in === "number" ? parsed.expires_in : undefined,
        refreshToken: typeof parsed.refresh_token === "string" ? parsed.refresh_token : undefined,
      },
    };
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
