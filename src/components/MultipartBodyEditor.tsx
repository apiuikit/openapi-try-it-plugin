import type { EditableBodyFieldRow } from "../types";
import { formatBytes, styles } from "../styles";

interface MultipartBodyEditorProps {
  rows: EditableBodyFieldRow[];
  onChange: (rows: EditableBodyFieldRow[]) => void;
}

let nextRowId = 0;
function makeRowId(): string {
  nextRowId += 1;
  return `multipart-row-${nextRowId}`;
}

export function MultipartBodyEditor({ rows, onChange }: MultipartBodyEditorProps) {
  function updateRow(id: string, patch: Partial<EditableBodyFieldRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    onChange(rows.filter((row) => row.id !== id));
  }

  function addRow() {
    onChange([...rows, { id: makeRowId(), key: "", isFile: false, value: "", enabled: true, fromSpec: false }]);
  }

  return (
    <div style={styles.section}>
      <span style={styles.sectionTitle}>Body (multipart/form-data)</span>
      <div style={styles.table}>
        {rows.map((row) => (
          <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <div style={styles.row}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={row.enabled}
                onChange={(event) => updateRow(row.id, { enabled: event.target.checked })}
                aria-label={`Include ${row.key || "field"}`}
              />
              <input
                style={{ ...styles.input, ...styles.nameInput }}
                value={row.key}
                placeholder="field name"
                readOnly={row.fromSpec}
                onChange={(event) => updateRow(row.id, { key: event.target.value })}
              />
              {row.isFile ? (
                <input
                  style={styles.input}
                  type="file"
                  multiple
                  onChange={(event) => updateRow(row.id, { files: event.target.files ? Array.from(event.target.files) : [] })}
                />
              ) : (
                <input
                  style={styles.input}
                  value={row.value}
                  placeholder={row.required ? "required" : "value"}
                  onChange={(event) => updateRow(row.id, { value: event.target.value })}
                />
              )}
              {!row.fromSpec && (
                <>
                  <select
                    style={styles.select}
                    value={row.isFile ? "file" : "text"}
                    onChange={(event) => updateRow(row.id, { isFile: event.target.value === "file", value: "", files: undefined })}
                  >
                    <option value="text">Text</option>
                    <option value="file">File</option>
                  </select>
                  <button type="button" style={styles.secondaryButton} onClick={() => removeRow(row.id)} aria-label={`Remove ${row.key}`}>
                    ×
                  </button>
                </>
              )}
            </div>
            {row.description && <span style={styles.hint}>{row.description}</span>}
            {row.isFile && row.files && row.files.length > 0 && (
              <span style={styles.hint}>{row.files.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ")}</span>
            )}
          </div>
        ))}
      </div>
      <button type="button" style={{ ...styles.secondaryButton, alignSelf: "flex-start" }} onClick={addRow}>
        + Add
      </button>
    </div>
  );
}
