import type { Credential, CredentialMap, SecurityRequirement } from "../types";
import { OAuth2AuthorizationCodeFields } from "./OAuth2AuthorizationCodeFields";
import { OAuth2ClientCredentialsFields } from "./OAuth2ClientCredentialsFields";
import { SecretInput } from "./SecretInput";
import { styles } from "../styles";

interface AuthPanelProps {
  requirements: SecurityRequirement[];
  selectedIndex: number;
  onSelectRequirement: (index: number) => void;
  credentials: CredentialMap;
  onChangeCredentials: (credentials: CredentialMap) => void;
}

function schemeLabel(requirement: SecurityRequirement): string {
  return requirement.map((r) => r.schemeName).join(" + ");
}

export function AuthPanel({ requirements, selectedIndex, onSelectRequirement, credentials, onChangeCredentials }: AuthPanelProps) {
  if (requirements.length === 0) return null;

  const selected = requirements[selectedIndex] ?? requirements[0] ?? [];

  function setCredential(schemeName: string, credential: Credential) {
    onChangeCredentials({ ...credentials, [schemeName]: credential });
  }

  return (
    <div style={styles.section}>
      <span style={styles.sectionTitle}>Authorization</span>
      {requirements.length > 1 && (
        <select style={styles.select} value={selectedIndex} onChange={(event) => onSelectRequirement(Number(event.target.value))}>
          {requirements.map((requirement, index) => (
            <option key={schemeLabel(requirement)} value={index}>
              {schemeLabel(requirement)}
            </option>
          ))}
        </select>
      )}
      {selected.map(({ schemeName, scheme, scopes }) => {
        const credential = credentials[schemeName];

        if (scheme.type === "apiKey") {
          return (
            <div key={schemeName} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={styles.label} htmlFor={`tryit-auth-${schemeName}`}>
                {schemeName} — API key ({scheme.in})
              </label>
              {scheme.in === "cookie" && (
                <span style={styles.hint}>
                  Browsers block scripts from setting the Cookie header directly — this value won&apos;t actually be sent.
                </span>
              )}
              <SecretInput
                id={`tryit-auth-${schemeName}`}
                value={credential?.kind === "apiKey" ? credential.value : ""}
                onChange={(value) => setCredential(schemeName, { kind: "apiKey", value })}
                placeholder={scheme.name}
              />
            </div>
          );
        }

        if (scheme.type === "http" && scheme.scheme?.toLowerCase() === "basic") {
          const basic = credential?.kind === "basic" ? credential : { kind: "basic" as const, username: "", password: "" };
          return (
            <div key={schemeName} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={styles.label}>{schemeName} — Basic auth</label>
              <div style={styles.row}>
                <input
                  style={styles.input}
                  value={basic.username}
                  placeholder="username"
                  onChange={(event) => setCredential(schemeName, { ...basic, username: event.target.value })}
                />
                <SecretInput
                  value={basic.password}
                  placeholder="password"
                  containerStyle={{ flex: 1 }}
                  onChange={(value) => setCredential(schemeName, { ...basic, password: value })}
                />
              </div>
            </div>
          );
        }

        if (scheme.type === "http") {
          return (
            <div key={schemeName} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={styles.label} htmlFor={`tryit-auth-${schemeName}`}>
                {schemeName} — Bearer token
              </label>
              <SecretInput
                id={`tryit-auth-${schemeName}`}
                value={credential?.kind === "bearer" ? credential.token : ""}
                onChange={(value) => setCredential(schemeName, { kind: "bearer", token: value })}
                placeholder="token"
              />
            </div>
          );
        }

        if (scheme.type === "oauth2" && scheme.flows.clientCredentials) {
          const { tokenUrl, scopes: declaredScopes } = scheme.flows.clientCredentials;
          return (
            <div key={schemeName} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={styles.label}>{schemeName} — OAuth2 (client_credentials)</label>
              <OAuth2ClientCredentialsFields
                tokenUrl={tokenUrl}
                availableScopes={Object.keys(declaredScopes ?? {})}
                requiredScopes={scopes}
                credential={credential?.kind === "oauth2ClientCredentials" ? credential : undefined}
                onChange={(next) => setCredential(schemeName, next)}
              />
            </div>
          );
        }

        if (scheme.type === "oauth2" && scheme.flows.authorizationCode) {
          const { authorizationUrl, tokenUrl, scopes: declaredScopes } = scheme.flows.authorizationCode;
          return (
            <div key={schemeName} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={styles.label}>{schemeName} — OAuth2 (authorization_code)</label>
              <OAuth2AuthorizationCodeFields
                authorizationUrl={authorizationUrl}
                tokenUrl={tokenUrl}
                availableScopes={Object.keys(declaredScopes ?? {})}
                requiredScopes={scopes}
                credential={credential?.kind === "oauth2AuthorizationCode" ? credential : undefined}
                onChange={(next) => setCredential(schemeName, next)}
              />
            </div>
          );
        }

        // oauth2 (implicit/password only) / openIdConnect: no automated flow
        // is run for these yet — paste an already-obtained access token
        // instead.
        return (
          <div key={schemeName} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={styles.label} htmlFor={`tryit-auth-${schemeName}`}>
              {schemeName} — {scheme.type}
              {scopes.length > 0 ? ` (scopes: ${scopes.join(", ")})` : ""}
            </label>
            <span style={styles.hint}>
              {scheme.type} sign-in isn&apos;t run by this panel yet — obtain a token elsewhere and paste it here.
            </span>
            <SecretInput
              id={`tryit-auth-${schemeName}`}
              value={credential?.kind === "manual" ? credential.token : ""}
              onChange={(value) => setCredential(schemeName, { kind: "manual", token: value })}
              placeholder="access token"
            />
          </div>
        );
      })}
    </div>
  );
}
