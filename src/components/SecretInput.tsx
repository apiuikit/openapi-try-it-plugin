import { useState, type CSSProperties } from "react";
import { styles } from "../styles";

interface SecretInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Merged onto the wrapping row — e.g. `{ flex: 1 }` when this sits beside
   * another field (like Basic auth's username) inside a shared row. */
  containerStyle?: CSSProperties;
}

/** Masked-by-default input with a reveal toggle, for credential fields
 * (API keys, bearer/OAuth tokens, Basic auth password) — matches Scalar's
 * Client Secret field rather than leaving secrets in plain text like a
 * regular text input. */
export function SecretInput({ id, value, onChange, placeholder, containerStyle }: SecretInputProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div style={{ ...styles.row, ...containerStyle }}>
      <input
        id={id}
        style={styles.input}
        type={revealed ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        style={styles.secondaryButton}
        onClick={() => setRevealed((current) => !current)}
        aria-label={revealed ? "Hide value" : "Show value"}
        aria-pressed={revealed}
      >
        {revealed ? "Hide" : "Show"}
      </button>
    </div>
  );
}
