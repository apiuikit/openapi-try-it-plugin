import { formatBytes, styles } from "../styles";

interface BinaryBodyEditorProps {
  contentType: string;
  file: File | null;
  onChange: (file: File | null) => void;
}

export function BinaryBodyEditor({ contentType, file, onChange }: BinaryBodyEditorProps) {
  return (
    <div style={styles.section}>
      <span style={styles.sectionTitle}>Body ({contentType})</span>
      <input style={styles.input} type="file" onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
      {file && (
        <div style={styles.row}>
          <span style={styles.hint}>
            {file.name} — {formatBytes(file.size)}
            {file.type && file.type !== contentType ? ` (sent as ${contentType}, browser reports ${file.type})` : ""}
          </span>
          <button type="button" style={styles.secondaryButton} onClick={() => onChange(null)}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
