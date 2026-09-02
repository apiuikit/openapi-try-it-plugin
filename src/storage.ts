import type { CredentialMap, ServerVariableValues } from "./types";

/** Credentials persist for the tab's lifetime only (`sessionStorage`, not
 * `localStorage`) — long-lived storage of API keys/passwords typed into a
 * docs page is the kind of thing that should require a deliberate choice by
 * the host app, not a plugin default. */
interface PersistedState {
  credentials: CredentialMap;
  serverVariables: ServerVariableValues;
}

function storageKey(documentKey: string): string {
  return `apiuikit-openapi-try-it-plugin:${documentKey}`;
}

/** Identifies a document across operations/reloads without hashing —
 * `info.title`+`info.version` is already how OpenAPI documents distinguish
 * themselves, and collisions just mean two specs share a credential slot,
 * which is an acceptable tradeoff for a session-scoped convenience cache. */
export function documentStorageKey(title: string | undefined, version: string | undefined): string {
  return `${title ?? "untitled"}@${version ?? "0"}`;
}

export function loadPersistedState(documentKey: string): PersistedState {
  const empty: PersistedState = { credentials: {}, serverVariables: {} };
  if (typeof window === "undefined") return empty;

  try {
    const raw = window.sessionStorage.getItem(storageKey(documentKey));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return { credentials: parsed.credentials ?? {}, serverVariables: parsed.serverVariables ?? {} };
  } catch {
    return empty;
  }
}

export function savePersistedState(documentKey: string, state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(documentKey), JSON.stringify(state));
  } catch {
    // Storage full/unavailable (private browsing, quota) — persistence is a
    // convenience, not a requirement, so fail silently.
  }
}
