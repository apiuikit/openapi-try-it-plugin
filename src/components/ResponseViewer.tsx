import ReactJsonView, { type ThemeObject } from "@microlink/react-json-view";
import { useDocumentContext } from "apiuikit/plugin";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { FetchOutcome } from "../types";
import { color, statusColor, styles } from "../styles";
import { useEscapeLayer } from "../escapeLayer";
import { useIsNarrowViewport } from "../useMediaQuery";
import { CloseIcon, ExpandIcon, SatelliteIcon } from "./icons";

interface ResponseViewerProps {
  outcome: FetchOutcome | null;
  sending: boolean;
}

/** Maps ReactJsonView's base-16 slots onto our own CSS-var-backed color
 * tokens (see styles.ts) so the tree follows the host's theme instead of a
 * fixed built-in scheme. react-json-view doesn't follow the generic base16
 * styling guide's role assignments (e.g. base07 is "light background,
 * rarely used" per the guide, but this library reuses it for `keyColor` and
 * `braceColor` — the actual key/brace *text* color) — this mapping is taken
 * from its own `Qt` theme-building function (dist/main.js) rather than the
 * guide, since following the guide left object keys unreadable (near-white
 * text on a light background). */
const jsonViewTheme: ThemeObject = {
  base00: color.surface, // backgroundColor
  base01: color.border, // editVariable/addKeyModal accents (unused, read-only)
  base02: color.border, // objectBorder + null/undefined pill background
  base03: color.textMuted, // unused by this library
  base04: color.textMuted, // objectSize ("3 items" label)
  base05: color.textMuted, // dataTypes.undefined
  base06: color.textPrimary, // unused by this library
  base07: color.textPrimary, // keyColor + braceColor — the key/brace text itself
  base08: color.error, // dataTypes.nan
  base09: color.success, // ellipsisColor + dataTypes.string/bigNumber
  base0A: color.textMuted, // dataTypes.null/regexp
  base0B: color.warning, // dataTypes.float
  base0C: color.primary700, // arrayKeyColor (array index numbers)
  base0D: color.textSecondary, // expandedIcon + dataTypes.date/function + copy-check
  base0E: color.primary600, // collapsedIcon + dataTypes.boolean
  base0F: color.warning, // dataTypes.integer + copyToClipboard icon
};

/** The response body is always fetched as text (see executeRequest.ts) since
 * it may be JSON, XML, plain text, or garbled binary — only render the tree
 * view when it actually parses as a JSON object/array; anything else (plain
 * text, HTML, a bare JSON scalar) falls back to the raw `<pre>`. */
function parseJsonObjectBody(body: string): object | undefined {
  const trimmed = body.trim();
  if (!trimmed) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function JsonTree({ src }: { src: object }) {
  return (
    <ReactJsonView
      src={src}
      theme={jsonViewTheme}
      style={{ background: "transparent", fontFamily: "inherit" }}
      name={false}
      iconStyle="triangle"
      displayDataTypes={false}
      quotesOnKeys={false}
    />
  );
}

function JsonModal({ src, onClose }: { src: object; onClose: () => void }) {
  const { portalHost } = useDocumentContext();
  const isNarrow = useIsNarrowViewport();

  useEscapeLayer(true, onClose);

  if (!portalHost) return null;

  return createPortal(
    <div
      data-tryit-modal=""
      style={isNarrow ? { ...styles.modalOverlay, ...styles.modalOverlayCompact } : styles.modalOverlay}
      onClick={onClose}
    >
      <div
        style={isNarrow ? { ...styles.modalContent, ...styles.modalContentCompact } : styles.modalContent}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <span style={styles.sectionTitle}>Response</span>
          <button type="button" style={styles.secondaryButton} title="Close" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div style={styles.modalBody}>
          <JsonTree src={src} />
        </div>
      </div>
    </div>,
    portalHost,
  );
}

export function ResponseViewer({ outcome, sending }: ResponseViewerProps) {
  const jsonBody = outcome?.kind === "success" ? parseJsonObjectBody(outcome.result.body) : undefined;
  const [isExpanded, setIsExpanded] = useState(false);
  const isEmpty = !sending && !outcome;

  return (
    <div style={isEmpty ? { ...styles.section, ...styles.sectionFill } : styles.section}>
      <span style={styles.sectionTitle}>Response</span>

      {sending && <span style={styles.hint}>Sending…</span>}

      {isEmpty && (
        <div style={styles.emptyState}>
          <SatelliteIcon />
          <span>Send the request to see the response here.</span>
        </div>
      )}

      {outcome?.kind === "cors-error" && (
        <p style={styles.errorText} role="alert">
          {outcome.message}
        </p>
      )}
      {outcome?.kind === "error" && (
        <p style={styles.errorText} role="alert">
          {outcome.message}
        </p>
      )}

      {outcome?.kind === "success" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={styles.row}>
            <span style={{ ...styles.label, color: statusColor(outcome.result.status) }}>
              {outcome.result.status} {outcome.result.statusText}
            </span>
            <span style={styles.hint}>{Math.round(outcome.result.durationMs)} ms</span>
          </div>
          {outcome.result.headers.length > 0 && (
            <details>
              <summary style={styles.hint}>Response headers ({outcome.result.headers.length})</summary>
              <pre style={styles.responseBody}>
                {outcome.result.headers.map(([name, value]) => `${name}: ${value}`).join("\n")}
              </pre>
            </details>
          )}
          {jsonBody !== undefined ? (
            <div style={{ position: "relative" }}>
              <div style={styles.responseBody}>
                <JsonTree src={jsonBody} />
              </div>
              <button
                type="button"
                style={styles.iconButton}
                title="Expand"
                aria-label="Expand"
                onClick={() => setIsExpanded(true)}
              >
                <ExpandIcon />
              </button>
            </div>
          ) : (
            <pre style={styles.responseBody}>{outcome.result.body}</pre>
          )}
        </div>
      )}

      {isExpanded && jsonBody !== undefined && <JsonModal src={jsonBody} onClose={() => setIsExpanded(false)} />}
    </div>
  );
}
