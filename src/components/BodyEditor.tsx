import { styles } from "../styles";
import { FormatIcon } from "./icons";

interface BodyEditorProps {
  contentType: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}

function formatJson(value: string): string | null {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return null;
  }
}

export function BodyEditor({ contentType, value, onChange, error }: BodyEditorProps) {
  return (
    <div style={styles.section}>
      <span style={styles.sectionTitle}>Body ({contentType})</span>
      <div style={{ position: "relative" }}>
        <textarea style={styles.textarea} value={value} placeholder="{}" onChange={(event) => onChange(event.target.value)} />
        <button
          type="button"
          style={styles.iconButton}
          title="Format JSON"
          aria-label="Format JSON"
          onClick={() => onChange(formatJson(value) ?? value)}
        >
          <FormatIcon />
        </button>
      </div>
      {error && (
        <p style={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
