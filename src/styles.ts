import type { CSSProperties } from "react";

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
};

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
