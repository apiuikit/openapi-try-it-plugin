import type { OpenAPIServerData } from "apiuikit/plugin";
import type { ServerVariableValues } from "../types";
import { styles } from "../styles";

interface ServerVariablesProps {
  servers: OpenAPIServerData[];
  selectedServerIndex: number;
  onSelectServer: (index: number) => void;
  values: ServerVariableValues;
  onChange: (values: ServerVariableValues) => void;
}

export function ServerVariables({ servers, selectedServerIndex, onSelectServer, values, onChange }: ServerVariablesProps) {
  if (servers.length === 0) return null;
  const server = servers[selectedServerIndex] ?? servers[0];
  if (!server) return null;
  const variableNames = Object.keys(server.variables ?? {});

  return (
    <div style={styles.section}>
      <span style={styles.sectionTitle}>Server</span>
      {servers.length > 1 ? (
        <select style={styles.select} value={selectedServerIndex} onChange={(event) => onSelectServer(Number(event.target.value))}>
          {servers.map((s, index) => (
            <option key={s.url} value={index}>
              {s.url}
              {s.description ? ` — ${s.description}` : ""}
            </option>
          ))}
        </select>
      ) : (
        <span style={styles.hint}>{server.url}</span>
      )}
      {variableNames.length > 0 && (
        <div style={styles.table}>
          {variableNames.map((name) => (
            <div key={name} style={styles.row}>
              <span style={{ ...styles.label, flex: "0 0 40%" }}>{`{${name}}`}</span>
              <input
                style={styles.input}
                value={values[name] ?? ""}
                onChange={(event) => onChange({ ...values, [name]: event.target.value })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
