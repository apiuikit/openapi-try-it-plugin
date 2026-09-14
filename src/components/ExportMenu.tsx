import { useEffect, useRef, useState } from "react";
import { useEscapeLayer } from "../escapeLayer";
import { buildExport, filenameForExport, type ExportFormat } from "../exportRequest";
import { styles } from "../styles";
import { ExportIcon } from "./icons";
import type { BuiltRequest, FetchOutcome } from "../types";

interface ExportMenuProps {
  name: string;
  method: string;
  path: string;
  /** Built on click so the file always matches the tables as they stand. */
  getRequest: () => BuiltRequest;
  outcome: FetchOutcome | null;
  /** Renders as a bare icon button for the panel header, where it sits
   * beside the close button and a full "Export" label would crowd the URL.
   * The dropdown aligns to the right edge there so it can't overflow. */
  iconOnly?: boolean;
}

const FORMATS: Array<{ format: ExportFormat; label: string }> = [
  { format: "postman", label: "Postman Collection" },
  { format: "insomnia", label: "Insomnia" },
  { format: "har", label: "HAR" },
];

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

const TRIGGER_TITLE = "Download this request for Postman, Insomnia, or HAR — credentials are replaced with placeholders";

export function ExportMenu({ name, method, path, getRequest, outcome, iconOnly }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Escape closes the menu without also dismissing the try-it modal or
  // apiuikit's operation panel underneath it. See `useEscapeLayer`.
  useEscapeLayer(open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function handleExport(format: ExportFormat) {
    try {
      const data = buildExport(format, { request: getRequest(), name, outcome });
      downloadJson(filenameForExport(format, method, path), data);
      setError(null);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't export this request");
    }
  }

  const menuStyle = iconOnly ? { ...styles.menu, ...styles.menuEnd } : styles.menu;

  return (
    <div ref={rootRef} style={{ position: "relative", flex: "0 0 auto" }}>
      <button
        type="button"
        style={iconOnly ? styles.iconAction : styles.secondaryButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="tryit-export-menu"
        aria-label={iconOnly ? "Export" : undefined}
        title={TRIGGER_TITLE}
        onClick={() => setOpen((current) => !current)}
      >
        {iconOnly ? <ExportIcon /> : "Export"}
      </button>
      {open && (
        <div id="tryit-export-menu" role="menu" style={menuStyle}>
          {FORMATS.map(({ format, label }) => (
            <button key={format} type="button" role="menuitem" style={styles.menuItem} onClick={() => handleExport(format)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {/* Absolutely positioned like the menu: in a header row, a message in
          normal flow would stretch the row's height. */}
      {error && (
        <p style={{ ...menuStyle, ...styles.errorText, padding: "0.375rem 0.625rem", margin: 0 }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
