import { useState } from "react";
import { fetchClientCredentialsToken } from "../oauth2ClientCredentials";
import { isOAuth2TokenExpired } from "../requestBuilder";
import { color, styles } from "../styles";
import type { OAuth2ClientCredentialsCredential } from "../types";
import { SecretInput } from "./SecretInput";

interface OAuth2ClientCredentialsFieldsProps {
  tokenUrl: string;
  /** Every scope the scheme declares (`flows.clientCredentials.scopes`), for
   * the checkbox list. */
  availableScopes: string[];
  /** The scopes this specific operation's security requirement actually
   * asks for — pre-checked by default so "Authorize" is a one-click action
   * for the common case, without assuming the client wants every scope the
   * API happens to define. */
  requiredScopes: string[];
  credential: OAuth2ClientCredentialsCredential | undefined;
  onChange: (credential: OAuth2ClientCredentialsCredential) => void;
}

function formatExpiry(credential: OAuth2ClientCredentialsCredential): string | null {
  if (credential.obtainedAt === undefined || credential.expiresInSeconds === undefined) return null;
  const remainingMs = credential.obtainedAt + credential.expiresInSeconds * 1000 - Date.now();
  if (remainingMs <= 0) return null;
  const remainingSeconds = Math.round(remainingMs / 1000);
  if (remainingSeconds < 60) return `${remainingSeconds}s`;
  return `${Math.round(remainingSeconds / 60)}m`;
}

export function OAuth2ClientCredentialsFields({
  tokenUrl,
  availableScopes,
  requiredScopes,
  credential,
  onChange,
}: OAuth2ClientCredentialsFieldsProps) {
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = credential?.clientId ?? "";
  const clientSecret = credential?.clientSecret ?? "";
  // Seeded once, from whichever of this operation's required scopes this
  // flow actually offers (a security requirement can name scopes that
  // belong to a different flow on the same scheme, e.g. an
  // authorizationCode-only scope under global security — those wouldn't be
  // checkable at all, so they're not useful as a default), falling back to
  // every declared scope when that intersection is empty. Then only ever
  // read back from `credential` once one exists, so a user's later edits
  // aren't overwritten on every render.
  const requiredAvailableScopes = requiredScopes.filter((scope) => availableScopes.includes(scope));
  const selectedScopes = credential?.selectedScopes ?? (requiredAvailableScopes.length > 0 ? requiredAvailableScopes : availableScopes);

  function patch(update: Partial<OAuth2ClientCredentialsCredential>) {
    onChange({
      kind: "oauth2ClientCredentials",
      clientId,
      clientSecret,
      selectedScopes,
      accessToken: credential?.accessToken,
      tokenType: credential?.tokenType,
      obtainedAt: credential?.obtainedAt,
      expiresInSeconds: credential?.expiresInSeconds,
      ...update,
    });
  }

  function toggleScope(scope: string) {
    const next = selectedScopes.includes(scope) ? selectedScopes.filter((s) => s !== scope) : [...selectedScopes, scope];
    patch({ selectedScopes: next });
  }

  async function handleAuthorize() {
    setError(null);
    setAuthorizing(true);
    const outcome = await fetchClientCredentialsToken({ tokenUrl, clientId, clientSecret, scopes: selectedScopes });
    setAuthorizing(false);
    if (outcome.kind === "error") {
      setError(outcome.message);
      return;
    }
    patch({
      accessToken: outcome.result.accessToken,
      tokenType: outcome.result.tokenType ?? "Bearer",
      obtainedAt: Date.now(),
      expiresInSeconds: outcome.result.expiresInSeconds,
    });
  }

  const expired = isOAuth2TokenExpired(credential);
  const authorized = !!credential?.accessToken && !expired;
  const expiry = credential ? formatExpiry(credential) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <span style={styles.hint}>Token URL: {tokenUrl}</span>

      <input style={styles.input} value={clientId} placeholder="client id" onChange={(event) => patch({ clientId: event.target.value })} />
      <SecretInput value={clientSecret} placeholder="client secret" onChange={(value) => patch({ clientSecret: value })} />

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

      <button type="button" style={styles.button} onClick={handleAuthorize} disabled={authorizing || !clientId || !clientSecret}>
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
