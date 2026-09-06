import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDocumentContext } from "apiuikit/plugin";
import type { OpenAPIOperationPluginContext } from "apiuikit/plugin";
import { createTryItSplitPanel } from "../TryItSplitPanel";
import type { TryItPluginOptions } from "../types";
import { color, methodTagStyle, styles, tryItRowStyle } from "../styles";
import { CloseIcon, ExpandIcon, PlayIcon } from "./icons";

/** Fills `openapi.operation.reference.supplementary`: a full-width row
 * between the operation's code samples and Authorization that opens the
 * "Try it" UI in a modal sized slightly smaller than the viewport, instead
 * of a dedicated tab. Uses `TryItSplitPanel` (request-building left,
 * response right, each independently scrolling) rather than `TryItPanel`'s
 * top-to-bottom layout — the modal has a fixed height to work with, not a
 * free-flowing page column, so a single vertically-scrolling column doesn't
 * fit as well. */
export function createTryItButton(options: TryItPluginOptions = {}) {
  const TryItSplitPanel = createTryItSplitPanel(options);

  return function TryItButton({ document, method, path }: OpenAPIOperationPluginContext) {
    const { portalHost, config } = useDocumentContext();
    const [isOpen, setIsOpen] = useState(false);
    const operation = document.paths?.[path]?.[method];

    useEffect(() => {
      if (!isOpen) return;
      // `window`, not `document` — the OpenAPI document is destructured as
      // `document` above, shadowing the global.
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setIsOpen(false);
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen]);

    if (!operation) return null;

    return (
      <>
        <button
          type="button"
          // Full-width row matching Authorization's geometry. Colors come
          // from `useDocumentContext().config.theme` (primary.600 for the
          // label, light/dark.border for the chrome) with CSS-variable
          // fallbacks for anything the host omitted.
          style={tryItRowStyle(config?.theme)}
          onClick={() => setIsOpen(true)}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <PlayIcon />
            Try it
          </span>
          <ExpandIcon />
        </button>
        {isOpen && portalHost &&
          createPortal(
            <div data-tryit-modal="" style={styles.modalOverlay} onClick={() => setIsOpen(false)}>
              <div style={styles.modalContentWide} onClick={(event) => event.stopPropagation()}>
                <div style={styles.modalHeader}>
                  {/* Method + path, not a static "Try it" — identifies which
                      operation this modal is for, since the reference panel
                      behind it is dimmed and its own header isn't visible. */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                    <span style={methodTagStyle(method)}>{method.toUpperCase()}</span>
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: color.textPrimary,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {path}
                    </span>
                  </div>
                  <button type="button" style={styles.secondaryButton} title="Close" aria-label="Close" onClick={() => setIsOpen(false)}>
                    <CloseIcon />
                  </button>
                </div>
                <TryItSplitPanel document={document} method={method} path={path} />
              </div>
            </div>,
            portalHost,
          )}
      </>
    );
  };
}
