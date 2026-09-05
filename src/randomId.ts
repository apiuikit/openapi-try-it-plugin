/** Cryptographically random id when `crypto.randomUUID` is available,
 * otherwise a timestamp+Math.random fallback for environments without it
 * (older browsers, non-secure-context iframes). Shared by OAuth `state`
 * and Insomnia export resource ids. */
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
