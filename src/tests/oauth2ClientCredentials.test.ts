import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchClientCredentialsToken } from "../oauth2ClientCredentials";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("fetchClientCredentialsToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs grant_type=client_credentials with HTTP Basic client auth, and returns the access token", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      jsonResponse(200, { access_token: "tok_abc", token_type: "Bearer", expires_in: 3600 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await fetchClientCredentialsToken({
      tokenUrl: "https://auth.example.com/token",
      clientId: "my-id",
      clientSecret: "my-secret",
      scopes: ["read:users", "write:users"],
    });

    expect(outcome).toEqual({
      kind: "success",
      result: { accessToken: "tok_abc", tokenType: "Bearer", expiresInSeconds: 3600 },
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://auth.example.com/token");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${btoa("my-id:my-secret")}`);
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("scope")).toBe("read:users write:users");
  });

  it("omits the scope param entirely when no scopes are selected", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => jsonResponse(200, { access_token: "tok" }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchClientCredentialsToken({ tokenUrl: "https://auth.example.com/token", clientId: "id", clientSecret: "secret", scopes: [] });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(new URLSearchParams(init.body as string).has("scope")).toBe(false);
  });

  it("surfaces the RFC 6749 error_description on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(400, { error: "invalid_client", error_description: "Client authentication failed" })),
    );

    const outcome = await fetchClientCredentialsToken({
      tokenUrl: "https://auth.example.com/token",
      clientId: "id",
      clientSecret: "wrong",
      scopes: [],
    });
    expect(outcome).toEqual({ kind: "error", message: "Client authentication failed" });
  });

  it("falls back to a status-based message when the error body has no error_description", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json", { status: 500, statusText: "Internal Server Error" })));

    const outcome = await fetchClientCredentialsToken({
      tokenUrl: "https://auth.example.com/token",
      clientId: "id",
      clientSecret: "secret",
      scopes: [],
    });
    expect(outcome).toEqual({ kind: "error", message: "Token request failed with 500 Internal Server Error" });
  });

  it("errors when a 2xx response has no access_token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { token_type: "Bearer" })));

    const outcome = await fetchClientCredentialsToken({
      tokenUrl: "https://auth.example.com/token",
      clientId: "id",
      clientSecret: "secret",
      scopes: [],
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

    const outcome = await fetchClientCredentialsToken({
      tokenUrl: "https://auth.example.com/token",
      clientId: "id",
      clientSecret: "secret",
      scopes: [],
    });
    expect(outcome).toEqual({ kind: "error", message: "Failed to fetch" });
  });
});
