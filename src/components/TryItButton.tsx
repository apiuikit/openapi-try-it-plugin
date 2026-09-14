import { useState } from "react";
import { createPortal } from "react-dom";
import { useDocumentContext } from "apiuikit/plugin";
import type { OpenAPIOperationPluginContext } from "apiuikit/plugin";
import { useEscapeLayer } from "../escapeLayer";
import { createTryItSplitPanel } from "../TryItSplitPanel";
import type { TryItPluginOptions } from "../types";
import { color, methodTagStyle, styles, tryItHeaderStyle, tryItRowStyle } from "../styles";
import { CloseIcon, ExpandIcon, PlayIcon } from "./icons";

/** Where the trigger lives, which is all that differs between the two
 * modal-based plugins: a full-width row in the Reference panel body, or a
 * compact button in the side panel's header. The modal they open is the
 * same. */
type TriggerVariant = "row" | "header";

/** Builds a component that opens the "Try it" UI in a modal sized slightly
 * smaller than the viewport. Uses `TryItSplitPanel` (request-building left,
 * response right, each independently scrolling) rather than `TryItPanel`'s
 * top-to-bottom layout — the modal has a fixed height to work with, not a
 * free-flowing page column, so a single vertically-scrolling column doesn't
 * fit as well. */
function createTryItLauncher(options: TryItPluginOptions, variant: TriggerVariant) {
  const TryItSplitPanel = createTryItSplitPanel(options);

  return function TryItLauncher({ document, method, path }: OpenAPIOperationPluginContext) {
    const { portalHost, config } = useDocumentContext();
    const [isOpen, setIsOpen] = useState(false);
    const operation = document.paths?.[path]?.[method];

    // Escape closes this modal only — not apiuikit's operation panel behind
    // it, and not while a nested overlay (export menu, response JSON) is on
    // top. See `useEscapeLayer`.
    useEscapeLayer(isOpen, () => setIsOpen(false));

    if (!operation) return null;

    return (
      <>
        {variant === "header" ? (
          <button
            type="button"
            // Label kept next to the icon rather than icon-only: the header
            // already carries an unlabeled close button, and a second bare
            // icon beside it reads as chrome, not as the panel's main action.
            style={{ ...tryItHeaderStyle(config?.theme), marginLeft: "10px" }}
            onClick={() => setIsOpen(true)}
          >
            <PlayIcon />
            Try It Out
          </button>
        ) : (
          <button
            type="button"
            // Full-width row matching Authorization's geometry. Colors come
            // from `useDocumentContext().config.theme` (primary.600 for the
            // label, light/dark.border for the chrome) with CSS-variable
            // fallbacks for anything the host omitted.
            style={tryItRowStyle(config?.theme)}
            onClick={() => setIsOpen(true)}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <PlayIcon />
              Try It Out
            </span>
            <ExpandIcon />
          </button>
        )}
        {isOpen &&
          portalHost &&
          createPortal(
            <div
              data-tryit-modal=""
              style={styles.modalOverlay}
              onClick={() => setIsOpen(false)}
            >
              <div
                style={styles.modalContentWide}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={styles.modalHeader}>
                  {/* Method + path, not a static "Try it" — identifies which
                      operation this modal is for, since the reference panel
                      behind it is dimmed and its own header isn't visible. */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      minWidth: 0,
                    }}
                  >
                    <span style={methodTagStyle(method)}>
                      {method.toUpperCase()}
                    </span>
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: color.textPrimary,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {path}
                    </span>
                  </div>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    title="Close"
                    aria-label="Close"
                    onClick={() => setIsOpen(false)}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <TryItSplitPanel
                  document={document}
                  method={method}
                  path={path}
                />
              </div>
            </div>,
            portalHost,
          )}
      </>
    );
  };
}

/** Fills `openapi.operation.reference.supplementary`: a full-width row
 * between the operation's code samples and Authorization. */
export function createTryItButton(options: TryItPluginOptions = {}) {
  return createTryItLauncher(options, "row");
}

/** Fills `openapi.operation.header`: a compact button in the side panel's
 * header row, next to the close button. Stays visible whichever tab is
 * selected, unlike the Reference-panel row above. */
export function createTryItHeaderButton(options: TryItPluginOptions = {}) {
  return createTryItLauncher(options, "header");
}
