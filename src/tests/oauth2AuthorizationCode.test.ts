import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  awaitAuthorizationCode,
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "../oauth2AuthorizationCode";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("buildAuthorizationUrl", () => {
  it("builds a response_type=code URL with client_id, redirect_uri, state, and joined scopes", () => {
    const url = buildAuthorizationUrl({
      authorizationUrl: "https://auth.example.com/authorize",
      clientId: "my-id",
      redirectUri: "https://app.example.com/callback",
      scopes: ["read:users", "write:users"],
      state: "abc123",
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://auth.example.com/authorize");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("my-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://app.example.com/callback");
    expect(parsed.searchParams.get("state")).toBe("abc123");
    expect(parsed.searchParams.get("scope")).toBe("read:users write:users");
  });

  it("omits the scope param entirely when no scopes are selected", () => {
    const url = buildAuthorizationUrl({
      authorizationUrl: "https://auth.example.com/authorize",
      clientId: "id",
      redirectUri: "https://app.example.com/callback",
      scopes: [],
      state: "s",
    });
    expect(new URL(url).searchParams.has("scope")).toBe(false);
  });

  it("adds code_challenge and code_challenge_method=S256 when a PKCE challenge is given", () => {
    const url = buildAuthorizationUrl({
      authorizationUrl: "https://auth.example.com/authorize",
      clientId: "id",
      redirectUri: "https://app.example.com/callback",
      scopes: [],
      state: "s",
      pkceCodeChallenge: "the-challenge",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("code_challenge")).toBe("the-challenge");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("omits both PKCE params when no challenge is given", () => {
    const url = buildAuthorizationUrl({
      authorizationUrl: "https://auth.example.com/authorize",
      clientId: "id",
      redirectUri: "https://app.example.com/callback",
      scopes: [],
      state: "s",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.has("code_challenge")).toBe(false);
    expect(parsed.searchParams.has("code_challenge_method")).toBe(false);
  });
});

describe("generateCodeVerifier", () => {
  it("returns a 43-character string built only from RFC 7636's unreserved character set", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toHaveLength(43);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("differs across calls", () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });
});

describe("generateCodeChallenge", () => {
  it("matches RFC 7636 Appendix B's worked example", async () => {
    const challenge = await generateCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("produces a URL-safe, unpadded string (no +, /, or = characters)", async () => {
    const challenge = await generateCodeChallenge(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
});

describe("generateState", () => {
  it("returns a non-empty string that differs across calls", () => {
    const a = generateState();
    const b = generateState();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

describe("exchangeAuthorizationCode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("authenticates via HTTP Basic and sends grant_type=authorization_code when a client secret is set", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      jsonResponse(200, { access_token: "tok_abc", token_type: "Bearer", expires_in: 3600, refresh_token: "refresh_xyz" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await exchangeAuthorizationCode({
      tokenUrl: "https://auth.example.com/token",
      code: "auth-code-1",
      redirectUri: "https://app.example.com/callback",
      clientId: "my-id",
      clientSecret: "my-secret",
    });

    expect(outcome).toEqual({
      kind: "success",
      result: { accessToken: "tok_abc", tokenType: "Bearer", expiresInSeconds: 3600, refreshToken: "refresh_xyz" },
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://auth.example.com/token");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${btoa("my-id:my-secret")}`);

    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code-1");
    expect(body.get("redirect_uri")).toBe("https://app.example.com/callback");
    expect(body.has("client_id")).toBe(false);
  });

  it("sends code_verifier in the body when PKCE was used", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => jsonResponse(200, { access_token: "tok" }));
    vi.stubGlobal("fetch", fetchMock);

    await exchangeAuthorizationCode({
      tokenUrl: "https://auth.example.com/token",
      code: "auth-code-1",
      redirectUri: "https://app.example.com/callback",
      clientId: "id",
      clientSecret: "secret",
      codeVerifier: "the-verifier",
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = new URLSearchParams(init.body as string);
    expect(body.get("code_verifier")).toBe("the-verifier");
  });

  it("omits code_verifier from the body when PKCE wasn't used", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => jsonResponse(200, { access_token: "tok" }));
    vi.stubGlobal("fetch", fetchMock);

    await exchangeAuthorizationCode({
      tokenUrl: "https://auth.example.com/token",
      code: "auth-code-1",
      redirectUri: "https://app.example.com/callback",
      clientId: "id",
      clientSecret: "secret",
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = new URLSearchParams(init.body as string);
    expect(body.has("code_verifier")).toBe(false);
  });

  it("sends client_id in the body with no Basic auth header for a public client (no secret)", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => jsonResponse(200, { access_token: "tok" }));
    vi.stubGlobal("fetch", fetchMock);

    await exchangeAuthorizationCode({
      tokenUrl: "https://auth.example.com/token",
      code: "auth-code-1",
      redirectUri: "https://app.example.com/callback",
      clientId: "public-id",
      clientSecret: "",
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    const body = new URLSearchParams(init.body as string);
    expect(body.get("client_id")).toBe("public-id");
  });

  it("surfaces the RFC 6749 error_description on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(400, { error: "invalid_grant", error_description: "Code expired" })),
    );

    const outcome = await exchangeAuthorizationCode({
      tokenUrl: "https://auth.example.com/token",
      code: "expired",
      redirectUri: "https://app.example.com/callback",
      clientId: "id",
      clientSecret: "secret",
    });
    expect(outcome).toEqual({ kind: "error", message: "Code expired" });
  });

  it("errors when a 2xx response has no access_token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { token_type: "Bearer" })));

    const outcome = await exchangeAuthorizationCode({
      tokenUrl: "https://auth.example.com/token",
      code: "code",
      redirectUri: "https://app.example.com/callback",
      clientId: "id",
      clientSecret: "secret",
    });
    expect(outcome).toEqual({ kind: "error", message: "Token response didn't include an access_token." });
  });

  it("catches a network failure rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const outcome = await exchangeAuthorizationCode({
      tokenUrl: "https://auth.example.com/token",
      code: "code",
      redirectUri: "https://app.example.com/callback",
      clientId: "id",
      clientSecret: "secret",
    });
    expect(outcome).toEqual({ kind: "error", message: "Failed to fetch" });
  });
});

/** A fake popup: starts "cross-origin" (`.location.href` throws), then
 * `navigateTo` flips it to same-origin-readable, mimicking a real popup
 * navigating from the provider's login page back to the redirect URI. */
function createFakePopup() {
  let closed = false;
  let href: string | null = null;
  return {
    get closed() {
      return closed;
    },
    close: vi.fn(() => {
      closed = true;
    }),
    get location() {
      if (href === null) throw new DOMException("Blocked a frame with origin from accessing a cross-origin frame.", "SecurityError");
      return { href };
    },
    navigateTo(url: string) {
      href = url;
    },
  };
}

describe("awaitAuthorizationCode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the code once the popup navigates to the redirect URI with a matching state", async () => {
    const popup = createFakePopup();
    const promise = awaitAuthorizationCode({
      popup: popup as unknown as Window,
      redirectUri: "https://app.example.com/callback",
      state: "expected-state",
      pollIntervalMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);
    popup.navigateTo("https://app.example.com/callback?code=the-code&state=expected-state");
    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toEqual({ kind: "success", code: "the-code" });
    expect(popup.close).toHaveBeenCalled();
  });

  it("ignores same-origin navigations that aren't the redirect URI itself", async () => {
    const popup = createFakePopup();
    const promise = awaitAuthorizationCode({
      popup: popup as unknown as Window,
      redirectUri: "https://app.example.com/callback",
      state: "s",
      pollIntervalMs: 100,
    });

    popup.navigateTo("https://app.example.com/some-other-page");
    await vi.advanceTimersByTimeAsync(100);
    // Still open, still waiting — that navigation didn't resolve anything.
    expect(popup.close).not.toHaveBeenCalled();

    popup.navigateTo("https://app.example.com/callback?code=c&state=s");
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toEqual({ kind: "success", code: "c" });
  });

  it("rejects a mismatched state as a possible CSRF response", async () => {
    const popup = createFakePopup();
    const promise = awaitAuthorizationCode({
      popup: popup as unknown as Window,
      redirectUri: "https://app.example.com/callback",
      state: "expected",
      pollIntervalMs: 100,
    });

    popup.navigateTo("https://app.example.com/callback?code=c&state=wrong");
    await vi.advanceTimersByTimeAsync(100);

    const outcome = await promise;
    expect(outcome.kind).toBe("error");
    expect((outcome as { message: string }).message).toMatch(/state/i);
  });

  it("surfaces the provider's error/error_description when it redirects with one", async () => {
    const popup = createFakePopup();
    const promise = awaitAuthorizationCode({
      popup: popup as unknown as Window,
      redirectUri: "https://app.example.com/callback",
      state: "s",
      pollIntervalMs: 100,
    });

    popup.navigateTo("https://app.example.com/callback?error=access_denied&error_description=User+declined&state=s");
    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toEqual({ kind: "error", message: "User declined" });
  });

  it("resolves with an error when the popup is closed before completing", async () => {
    const popup = createFakePopup();
    const promise = awaitAuthorizationCode({
      popup: popup as unknown as Window,
      redirectUri: "https://app.example.com/callback",
      state: "s",
      pollIntervalMs: 100,
    });

    popup.close();
    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toEqual({
      kind: "error",
      message: "Authorization was cancelled — the popup was closed before completing.",
    });
  });

  it("times out if the popup never reaches the redirect URI", async () => {
    const popup = createFakePopup();
    const promise = awaitAuthorizationCode({
      popup: popup as unknown as Window,
      redirectUri: "https://app.example.com/callback",
      state: "s",
      pollIntervalMs: 100,
      timeoutMs: 300,
    });

    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toEqual({ kind: "error", message: "Authorization timed out." });
    expect(popup.close).toHaveBeenCalled();
  });
});
