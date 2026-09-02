import type { EditableArrayValue, EditableDeepObjectEntry, EditableParamRow } from "../types";
import { styles } from "../styles";

interface ParamsTableProps {
  title: string;
  rows: EditableParamRow[];
  onChange: (rows: EditableParamRow[]) => void;
  /** Path params are entirely spec-driven (the URL template defines which
   * ones exist) — no add/remove row for those. Query/header/cookie tables
   * allow freeform rows on top of whatever the spec declares. */
  allowCustomRows?: boolean;
  /** Shown under the section title — for a caveat that applies to the whole
   * table (e.g. the Cookies table's browser-enforced limitation), not any
   * one row. */
  warning?: string;
}

function duplicateDeepObjectKeys(entries: EditableParamRow["deepObjectEntries"]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries ?? []) {
    if (!entry.enabled || entry.key === "") continue;
    if (seen.has(entry.key)) duplicates.add(entry.key);
    seen.add(entry.key);
  }
  return duplicates;
}

let nextRowId = 0;
function makeRowId(): string {
  nextRowId += 1;
  return `custom-row-${nextRowId}`;
}

export function ParamsTable({ title, rows, onChange, allowCustomRows = false, warning }: ParamsTableProps) {
  if (rows.length === 0 && !allowCustomRows) return null;

  function updateRow(id: string, patch: Partial<EditableParamRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateDeepObjectEntry(rowId: string, entryId: string, patch: Partial<EditableDeepObjectEntry>) {
    onChange(
      rows.map((row) =>
        row.id === rowId
          ? { ...row, deepObjectEntries: (row.deepObjectEntries ?? []).map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)) }
          : row,
      ),
    );
  }

  function updateArrayValue(rowId: string, entryId: string, patch: Partial<EditableArrayValue>) {
    onChange(
      rows.map((row) =>
        row.id === rowId
          ? { ...row, arrayValues: (row.arrayValues ?? []).map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)) }
          : row,
      ),
    );
  }

  function removeArrayValue(rowId: string, entryId: string) {
    onChange(
      rows.map((row) =>
        row.id === rowId ? { ...row, arrayValues: (row.arrayValues ?? []).filter((entry) => entry.id !== entryId) } : row,
      ),
    );
  }

  function removeRow(id: string) {
    onChange(rows.filter((row) => row.id !== id));
  }

  function addRow() {
    onChange([...rows, { id: makeRowId(), in: rows[0]?.in ?? "query", name: "", value: "", enabled: true, fromSpec: false }]);
  }

  return (
    <div style={styles.section}>
      <span style={styles.sectionTitle}>{title}</span>
      {warning && <span style={styles.hint}>{warning}</span>}
      <div style={styles.table}>
        {rows.map((row) => (
          <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <div style={styles.row}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={row.enabled}
                onChange={(event) => updateRow(row.id, { enabled: event.target.checked })}
                aria-label={`Include ${row.name || "parameter"}`}
              />
              <input
                style={{ ...styles.input, ...styles.nameInput }}
                value={row.name}
                placeholder="name"
                readOnly={row.fromSpec}
                onChange={(event) => updateRow(row.id, { name: event.target.value })}
              />
              {!row.deepObject && !row.isArray && (
                <input
                  style={styles.input}
                  value={row.value}
                  placeholder={row.required ? "required" : "value"}
                  onChange={(event) => updateRow(row.id, { value: event.target.value })}
                />
              )}
              {!row.fromSpec && (
                <button type="button" style={styles.secondaryButton} onClick={() => removeRow(row.id)} aria-label={`Remove ${row.name}`}>
                  ×
                </button>
              )}
            </div>
            {row.description && <span style={styles.hint}>{row.description}</span>}
            {row.isArray && (
              <span style={styles.hint}>
                array · {row.arrayStyle} · {row.arrayExplode ? "exploded" : "joined"}
              </span>
            )}
            {row.isArray && (
              <div style={{ ...styles.table, marginLeft: "1.5rem" }}>
                {(row.arrayValues ?? []).map((entry) => (
                  <div key={entry.id} style={styles.row}>
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={entry.enabled}
                      onChange={(event) => updateArrayValue(row.id, entry.id, { enabled: event.target.checked })}
                    />
                    <input
                      style={styles.input}
                      value={entry.value}
                      placeholder="value"
                      onChange={(event) => updateArrayValue(row.id, entry.id, { value: event.target.value })}
                    />
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => removeArrayValue(row.id, entry.id)}
                      aria-label="Remove value"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  style={{ ...styles.secondaryButton, alignSelf: "flex-start" }}
                  onClick={() =>
                    updateRow(row.id, {
                      arrayValues: [...(row.arrayValues ?? []), { id: makeRowId(), value: "", enabled: true }],
                    })
                  }
                >
                  + value
                </button>
              </div>
            )}
            {row.deepObject && (
              <div style={{ ...styles.table, marginLeft: "1.5rem" }}>
                {(() => {
                  const duplicates = duplicateDeepObjectKeys(row.deepObjectEntries);
                  return duplicates.size > 0 ? (
                    <span style={styles.hint}>
                      Duplicate key{duplicates.size > 1 ? "s" : ""} {Array.from(duplicates).join(", ")} — only the last enabled
                      value is sent.
                    </span>
                  ) : null;
                })()}
                {(row.deepObjectEntries ?? []).map((entry) => (
                  <div key={entry.id} style={styles.row}>
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={entry.enabled}
                      onChange={(event) => updateDeepObjectEntry(row.id, entry.id, { enabled: event.target.checked })}
                    />
                    <input
                      style={{ ...styles.input, ...styles.nameInput }}
                      value={entry.key}
                      placeholder="key"
                      onChange={(event) => updateDeepObjectEntry(row.id, entry.id, { key: event.target.value })}
                    />
                    <input
                      style={styles.input}
                      value={entry.value}
                      placeholder="value"
                      onChange={(event) => updateDeepObjectEntry(row.id, entry.id, { value: event.target.value })}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  style={{ ...styles.secondaryButton, alignSelf: "flex-start" }}
                  onClick={() =>
                    updateRow(row.id, {
                      deepObjectEntries: [...(row.deepObjectEntries ?? []), { id: makeRowId(), key: "", value: "", enabled: true }],
                    })
                  }
                >
                  + field
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {allowCustomRows && (
        <button type="button" style={{ ...styles.secondaryButton, alignSelf: "flex-start" }} onClick={addRow}>
          + Add
        </button>
      )}
    </div>
  );
}
