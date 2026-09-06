import type { CSSProperties } from "react";
import type { ThemeConfig } from "apiuikit/plugin";

/** Reads the host's theme via the documented CSS custom properties
 * (apiuikit-website/src/content/docs/plugins.md "Matching the host's theme")
 * instead of hardcoding colors, so this panel follows the host's theme
 * (including live changes) automatically. */
export const color = {
  border: "rgb(var(--color-border, 228 228 231) / 1)",
  surface: "rgb(var(--color-surface, 250 250 250) / 1)",
  background: "rgb(var(--color-background, 255 255 255) / 1)",
  textPrimary: "rgb(var(--color-text-primary, 24 24 27) / 1)",
  textSecondary: "rgb(var(--color-text-secondary, 82 82 91) / 1)",
  textMuted: "rgb(var(--color-text-muted, 161 161 170) / 1)",
  neutral50: "rgb(var(--color-neutral-50, 248 250 252) / 1)",
  primary600: "rgb(var(--color-primary-600, 37 99 235) / 1)",
  primary700: "rgb(var(--color-primary-700, 29 78 216) / 1)",
  success: "#16a34a",
  error: "#dc2626",
  warning: "#d97706",
} as const;

export const styles: Record<string, CSSProperties> = {
  panel: { display: "flex", flexDirection: "column", gap: "1.25rem", fontSize: "0.8125rem" },
  section: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  sectionTitle: { fontSize: "0.75rem", fontWeight: 600, color: color.textSecondary, textTransform: "uppercase", letterSpacing: "0.02em" },
  urlBar: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 0.625rem",
    borderRadius: "0.375rem",
    border: `1px solid ${color.border}`,
    background: color.surface,
  },
  urlText: {
    fontSize: "0.75rem",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    color: color.textPrimary,
    wordBreak: "break-all",
    flex: 1,
    minWidth: 0,
  },
  table: { display: "flex", flexDirection: "column", gap: "0.375rem" },
  row: { display: "flex", alignItems: "center", gap: "0.5rem" },
  input: {
    fontSize: "0.8125rem",
    padding: "0.375rem 0.5rem",
    borderRadius: "0.25rem",
    border: `1px solid ${color.border}`,
    color: color.textPrimary,
    background: "transparent",
    fontFamily: "inherit",
    flex: 1,
    minWidth: 0,
  },
  nameInput: { flex: "0 0 40%" },
  textarea: {
    fontSize: "0.75rem",
    padding: "0.5rem",
    borderRadius: "0.25rem",
    border: `1px solid ${color.border}`,
    color: color.textPrimary,
    background: "transparent",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    minHeight: "6rem",
    resize: "vertical",
    width: "100%",
    boxSizing: "border-box",
  },
  label: { fontSize: "0.75rem", fontWeight: 500, color: color.textSecondary },
  hint: { fontSize: "0.7rem", color: color.textMuted },
  button: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    padding: "0.375rem 0.875rem",
    borderRadius: "0.375rem",
    border: "none",
    background: color.primary600,
    color: "#fff",
    cursor: "pointer",
  },
  secondaryButton: {
    fontSize: "0.75rem",
    fontWeight: 500,
    padding: "0.25rem 0.625rem",
    borderRadius: "0.375rem",
    border: `1px solid ${color.border}`,
    background: "transparent",
    color: color.textSecondary,
    cursor: "pointer",
  },
  /** Full-width row matching the host Authorization `CollapsiblePanel`
   * (`rounded-lg`, `px-4 py-3`, bordered, `bg-neutral-50`). Fallback colors
   * are CSS custom properties; `tryItRowStyle` overlays hex from
   * `config.theme` when the host passed them. */
  rowButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    boxSizing: "border-box",
    fontSize: "0.8125rem",
    fontWeight: 500,
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    border: `1px solid ${color.border}`,
    background: color.neutral50,
    color: color.primary600,
    cursor: "pointer",
    gap: "0.5rem",
  },
  actions: { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" },
  menu: {
    position: "absolute",
    top: "calc(100% + 0.25rem)",
    left: 0,
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    minWidth: "12.5rem",
    padding: "0.25rem",
    borderRadius: "0.375rem",
    border: `1px solid ${color.border}`,
    background: color.background,
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.12)",
  },
  menuItem: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    padding: "0.375rem 0.625rem",
    borderRadius: "0.25rem",
    border: "none",
    background: "transparent",
    color: color.textPrimary,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  },
  select: {
    fontSize: "0.8125rem",
    padding: "0.375rem 0.5rem",
    borderRadius: "0.25rem",
    border: `1px solid ${color.border}`,
    color: color.textPrimary,
    background: "transparent",
  },
  responseBody: {
    fontSize: "0.75rem",
    padding: "0.625rem",
    borderRadius: "0.25rem",
    background: color.surface,
    border: `1px solid ${color.border}`,
    color: color.textPrimary,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    maxHeight: "24rem",
    overflowY: "auto",
  },
  errorText: { fontSize: "0.8125rem", color: color.error },
  checkbox: { flex: "0 0 auto", cursor: "pointer" },
  iconButton: {
    position: "absolute",
    top: "0.375rem",
    right: "0.375rem",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1.625rem",
    height: "1.625rem",
    padding: 0,
    borderRadius: "0.25rem",
    border: `1px solid ${color.border}`,
    background: color.surface,
    color: color.textSecondary,
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    zIndex: 2147483000,
  },
  modalContent: {
    background: color.background,
    border: `1px solid ${color.border}`,
    borderRadius: "0.5rem",
    width: "100%",
    height: "100%",
    maxWidth: "64rem",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  /** Same overlay/sizing rules as `modalContent`, just without its `64rem`
   * cap — for the "Try it" panel itself (params tables, auth, body editor,
   * response viewer all at once) rather than a single JSON tree. */
  modalContentWide: {
    background: color.background,
    border: `1px solid ${color.border}`,
    borderRadius: "0.5rem",
    width: "100%",
    height: "100%",
    maxWidth: "90rem",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 1rem",
    borderBottom: `1px solid ${color.border}`,
    flex: "0 0 auto",
  },
  modalBody: {
    flex: 1,
    overflow: "auto",
    padding: "1rem",
  },
  /** Used instead of `modalBody` by the reference-panel button's modal — a
   * row of two independently-scrolling columns rather than one vertically
   * scrolling column, so this container itself never scrolls. */
  modalBodySplit: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "row",
    overflow: "hidden",
  },
  splitColumn: {
    flex: 1,
    minWidth: 0,
    overflowY: "auto",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    fontSize: "0.8125rem",
  },
};

/** Overlay the host's `config.theme` onto `styles.rowButton`.
 *
 * Chrome (border, optional `colors.neutral.50`) comes from the active
 * `light`/`dark` block — light wins if both are set, matching
 * `buildThemeVars`. The label uses `colors.primary.600`, the same accent
 * apiuikit's own chrome uses for interactive text, rather than painting
 * `primary.50` across the whole row. Omitted fields keep the CSS-variable
 * fallbacks: `config` is unmerged with defaults. */
export function tryItRowStyle(theme?: ThemeConfig): CSSProperties {
  const mode = theme?.light ?? theme?.dark;
  const primary600 = theme?.colors?.primary?.[600];
  const neutral50 = theme?.colors?.neutral?.[50];
  return {
    ...styles.rowButton,
    ...(mode?.border ? { border: `1px solid ${mode.border}` } : {}),
    ...(neutral50 ? { background: neutral50 } : {}),
    ...(primary600 ? { color: primary600 } : {}),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function statusColor(status: number): string {
  if (status >= 200 && status < 300) return color.success;
  if (status >= 400) return color.error;
  if (status >= 300) return color.warning;
  return color.textSecondary;
}

/** Per-verb `{background, text}` pairs matching apiuikit's own method badges
 * in the endpoints list — sampled directly from its rendered pixels rather
 * than guessed: GET's badge there is exactly `#DBEAFE`/`#1E40AF` (Tailwind's
 * `blue-100`/`blue-800`) and DELETE's is `#FEE2E2`/`#991B1B`
 * (`red-100`/`red-800`), which is what gave away the pattern — a fixed
 * `bg-{color}-100`/`text-{color}-800` pairing, not derived from the host's
 * brand/primary color (that would follow `--color-primary-*`, which on this
 * host is teal, not blue — the mismatch that prompted this fix). The
 * remaining verbs (PUT confirmed amber; POST/PATCH/HEAD/OPTIONS/TRACE not
 * directly observed) follow the same `-100`/`-800` pairing for consistency. */
const METHOD_COLORS: Record<string, { background: string; text: string }> = {
  get: { background: "#DBEAFE", text: "#1E40AF" }, // blue-100 / blue-800
  post: { background: "#DCFCE7", text: "#166534" }, // green-100 / green-800
  put: { background: "#FEF3C7", text: "#92400E" }, // amber-100 / amber-800
  patch: { background: "#F3E8FF", text: "#6B21A8" }, // purple-100 / purple-800
  delete: { background: "#FEE2E2", text: "#991B1B" }, // red-100 / red-800
  head: { background: "#F3F4F6", text: "#1F2937" }, // gray-100 / gray-800
  options: { background: "#F3F4F6", text: "#1F2937" },
  trace: { background: "#F3F4F6", text: "#1F2937" },
};

/** A soft/pastel filled pill — matching apiuikit's own method badges in the
 * endpoints list — rather than a saturated solid-fill badge that reads as a
 * button. */
export function methodTagStyle(method: string): CSSProperties {
  const { background, text } = METHOD_COLORS[method.toLowerCase()] ?? METHOD_COLORS.head!;
  return {
    flex: "0 0 auto",
    fontSize: "0.6875rem",
    fontWeight: 700,
    padding: "0.125rem 0.4375rem",
    borderRadius: "0.25rem",
    background,
    color: text,
    letterSpacing: "0.02em",
  };
}
