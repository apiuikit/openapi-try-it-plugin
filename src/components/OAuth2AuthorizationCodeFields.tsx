import { useState } from "react";
import {
  awaitAuthorizationCode,
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "../oauth2AuthorizationCode";
import { isOAuth2TokenExpired } from "../requestBuilder";
import { color, styles } from "../styles";
import type { OAuth2AuthorizationCodeCredential } from "../types";
import { SecretInput } from "./SecretInput";

interface OAuth2AuthorizationCodeFieldsProps {
  authorizationUrl: string;
  tokenUrl: string;
  /** Every scope the scheme declares (`flows.authorizationCode.scopes`), for
   * the checkbox list. */
  availableScopes: string[];
  /** The scopes this specific operation's security requirement actually
   * asks for — pre-checked by default, same convenience as the
   * client_credentials fields. */
  requiredScopes: string[];
  credential: OAuth2AuthorizationCodeCredential | undefined;
  onChange: (credential: OAuth2AuthorizationCodeCredential) => void;
}

function formatExpiry(credential: OAuth2AuthorizationCodeCredential): string | null {
  if (credential.obtainedAt === undefined || credential.expiresInSeconds === undefined) return null;
  const remainingMs = credential.obtainedAt + credential.expiresInSeconds * 1000 - Date.now();
  if (remainingMs <= 0) return null;
  const remainingSeconds = Math.round(remainingMs / 1000);
  if (remainingSeconds < 60) return `${remainingSeconds}s`;
  return `${Math.round(remainingSeconds / 60)}m`;
}

export function OAuth2AuthorizationCodeFields({
  authorizationUrl,
  tokenUrl,
  availableScopes,
  requiredScopes,
  credential,
  onChange,
}: OAuth2AuthorizationCodeFieldsProps) {
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = credential?.clientId ?? "";
  const clientSecret = credential?.clientSecret ?? "";
  // Defaults to the current page — the common case for a docs page that has
  // registered itself as the OAuth client's redirect URI — but stays
  // editable since the real registered value might be a different route.
  const redirectUri = credential?.redirectUri ?? (typeof window !== "undefined" ? window.location.href : "");
  const usePkce = credential?.usePkce ?? true;

  const requiredAvailableScopes = requiredScopes.filter((scope) => availableScopes.includes(scope));
  const selectedScopes = credential?.selectedScopes ?? (requiredAvailableScopes.length > 0 ? requiredAvailableScopes : availableScopes);

  function patch(update: Partial<OAuth2AuthorizationCodeCredential>) {
    onChange({
      kind: "oauth2AuthorizationCode",
      clientId,
      clientSecret,
      redirectUri,
      usePkce,
      selectedScopes,
      accessToken: credential?.accessToken,
      tokenType: credential?.tokenType,
      obtainedAt: credential?.obtainedAt,
      expiresInSeconds: credential?.expiresInSeconds,
      refreshToken: credential?.refreshToken,
      ...update,
    });
  }

  function toggleScope(scope: string) {
    const next = selectedScopes.includes(scope) ? selectedScopes.filter((s) => s !== scope) : [...selectedScopes, scope];
    patch({ selectedScopes: next });
  }

  async function handleAuthorize() {
    setError(null);

    // Opened synchronously, before any `await`, so browsers' popup blockers
    // don't discard it — the auth URL is filled in only after the window
    // exists.
    const popup = window.open("about:blank", "apiuikit-oauth2-authorize", "width=520,height=720");
    if (!popup) {
      setError("Popup blocked — allow popups for this site and try again.");
      return;
    }

    setAuthorizing(true);
    const state = generateState();
    const codeVerifier = usePkce ? generateCodeVerifier() : undefined;
    const codeChallenge = codeVerifier ? await generateCodeChallenge(codeVerifier) : undefined;
    popup.location.href = buildAuthorizationUrl({
      authorizationUrl,
      clientId,
      redirectUri,
      scopes: selectedScopes,
      state,
      pkceCodeChallenge: codeChallenge,
    });

    const callback = await awaitAuthorizationCode({ popup, redirectUri, state });
    if (callback.kind === "error") {
      setAuthorizing(false);
      setError(callback.message);
      return;
    }

    const tokenOutcome = await exchangeAuthorizationCode({ tokenUrl, code: callback.code, redirectUri, clientId, clientSecret, codeVerifier });
    setAuthorizing(false);
    if (tokenOutcome.kind === "error") {
      setError(tokenOutcome.message);
      return;
    }

    patch({
      accessToken: tokenOutcome.result.accessToken,
      tokenType: tokenOutcome.result.tokenType ?? "Bearer",
      obtainedAt: Date.now(),
      expiresInSeconds: tokenOutcome.result.expiresInSeconds,
      refreshToken: tokenOutcome.result.refreshToken,
    });
  }

  const expired = isOAuth2TokenExpired(credential);
  const authorized = !!credential?.accessToken && !expired;
  const expiry = credential ? formatExpiry(credential) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <span style={styles.hint}>Authorization URL: {authorizationUrl}</span>
      <span style={styles.hint}>Token URL: {tokenUrl}</span>

      <input style={styles.input} value={clientId} placeholder="client id" onChange={(event) => patch({ clientId: event.target.value })} />
      <SecretInput
        value={clientSecret}
        placeholder="client secret (optional — leave blank for a public client)"
        onChange={(value) => patch({ clientSecret: value })}
      />
      <input
        style={styles.input}
        value={redirectUri}
        placeholder="redirect URI"
        onChange={(event) => patch({ redirectUri: event.target.value })}
      />
      <span style={styles.hint}>Must match a redirect URI registered with this client — the popup only completes once it navigates here.</span>

      <label style={{ ...styles.row, cursor: "pointer" }}>
        <input
          type="checkbox"
          style={styles.checkbox}
          checked={usePkce}
          onChange={(event) => patch({ usePkce: event.target.checked })}
        />
        <span style={styles.hint}>Use PKCE (recommended)</span>
      </label>

      {availableScopes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={styles.row}>
            <span style={styles.hint}>
              Scopes ({selectedScopes.length}/{availableScopes.length})
            </span>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => patch({ selectedScopes: selectedScopes.length === availableScopes.length ? [] : availableScopes })}
            >
              {selectedScopes.length === availableScopes.length ? "Clear all" : "Select all"}
            </button>
          </div>
          {availableScopes.map((scope) => (
            <label key={scope} style={{ ...styles.row, cursor: "pointer" }}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={selectedScopes.includes(scope)}
                onChange={() => toggleScope(scope)}
              />
              <span style={styles.hint}>{scope}</span>
            </label>
          ))}
        </div>
      )}

      <button type="button" style={styles.button} onClick={handleAuthorize} disabled={authorizing || !clientId || !redirectUri}>
        {authorizing ? "Authorizing…" : authorized ? "Re-authorize" : "Authorize"}
      </button>

      {authorized && (
        <span style={{ ...styles.hint, color: color.success }}>Authorized{expiry ? ` — expires in ${expiry}` : ""}</span>
      )}
      {expired && !authorizing && <span style={styles.hint}>Token expired — authorize again.</span>}
      {error && (
        <p style={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
