import type { ReactNode } from "react";
import { methodTagStyle, styles } from "../styles";

interface RequestUrlBarProps {
  method: string;
  url: string;
  /** Trailing actions — the export menu in both layouts, plus a close
   * button in the modal. */
  children?: ReactNode;
  /** `"header"` is the modal's own header row: flush with the modal edges,
   * bottom border, fixed height. `"bar"` is the tab's bordered pill, which
   * sits in a free-flowing page column and may wrap. */
  variant?: "bar" | "header";
}

/** The panel's header: method, the exact absolute URL `Send` will hit
 * (server plus substituted path params plus query string), and the panel's
 * top-level actions.
 *
 * This is the only place the resolved URL appears — the "Server" section
 * shows just the base URL/template, and path params are edited in their own
 * table with no preview of the resulting path. It used to render as a second
 * bar below the modal's method+path title, which said the same thing twice
 * in less room; the title now carries the full URL instead. */
export function RequestUrlBar({ method, url, children, variant = "bar" }: RequestUrlBarProps) {
  const isHeader = variant === "header";
  return (
    <div style={isHeader ? styles.headerRow : styles.urlBar}>
      <span style={methodTagStyle(method)}>{method.toUpperCase()}</span>
      {/* `title` so a URL truncated in the modal's fixed-height header is
          still readable in full on hover. */}
      <span style={isHeader ? styles.urlTextSingleLine : styles.urlText} title={url}>
        {url}
      </span>
      {children}
    </div>
  );
}
