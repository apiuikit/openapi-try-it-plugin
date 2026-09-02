export interface ClientCredentialsTokenResult {
  accessToken: string;
  tokenType?: string;
  expiresInSeconds?: number;
}

export type ClientCredentialsOutcome = { kind: "success"; result: ClientCredentialsTokenResult } | { kind: "error"; message: string };

export interface FetchClientCredentialsTokenInput {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

function readErrorMessage(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    // RFC 6749 §5.2 error response shape.
    if (typeof record.error_description === "string") return record.error_description;
    if (typeof record.error === "string") return record.error;
  }
  return `Token request failed with ${status} ${statusText}`;
}

/** Runs OAuth2's `client_credentials` grant (RFC 6749 §4.4) against a
 * scheme's declared `tokenUrl` — the one OAuth2 flow simple enough to run
 * without a redirect: POST client id/secret (as HTTP Basic per §2.3.1 —
 * confidential clients MUST use exactly one authentication method, so this
 * doesn't also send them in the body) and get an access token straight
 * back. */
export async function fetchClientCredentialsToken(input: FetchClientCredentialsTokenInput): Promise<ClientCredentialsOutcome> {
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (input.scopes.length > 0) body.set("scope", input.scopes.join(" "));

  // RFC 6749 Appendix B: percent-encode id/secret before joining with `:`
  // and base64-encoding, so a `:` or `%` inside either doesn't corrupt the
  // Basic credential.
  const basicCredential = btoa(`${encodeURIComponent(input.clientId)}:${encodeURIComponent(input.clientSecret)}`);

  try {
    const response = await fetch(input.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${basicCredential}`,
      },
      body: body.toString(),
    });

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
      },
    };
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
