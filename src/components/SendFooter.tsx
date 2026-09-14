import { styles } from "../styles";

interface SendFooterProps {
  sending: boolean;
  onSend: () => void;
  /** `"pinned"` sits at the bottom of the modal's fixed-height request
   * column; `"sticky"` follows the viewport down the tab's page column. */
  variant?: "pinned" | "sticky";
}

/** `Send`, kept reachable without scrolling to the end of the request form.
 * Shared by both layouts so the button's geometry stays identical between
 * them.
 *
 * Just the button: a rejected `Send` reports itself in the body editor,
 * which is the last section above this footer, so the message lands next to
 * the button that was clicked without being repeated here. */
export function SendFooter({ sending, onSend, variant = "pinned" }: SendFooterProps) {
  return (
    <div style={variant === "sticky" ? styles.sendFooterSticky : styles.sendFooter}>
      <button type="button" style={styles.sendButton} onClick={onSend} disabled={sending}>
        {sending ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
