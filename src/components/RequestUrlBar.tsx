import { styles } from "../styles";

interface RequestUrlBarProps {
  url: string;
}

/** Shows the exact absolute URL `Send` will hit — server plus substituted
 * path params plus query string — since nothing else in the panel does:
 * the "Server" section only shows the base URL/template, and path params
 * are edited in their own table without a preview of the resulting path.
 *
 * URL text only, no method badge — both places this renders (the tab, and
 * the reference-panel button's modal) already show the method right next
 * to it: the host's own page header for the tab, this plugin's own modal
 * title for the modal. Repeating it a third time here was redundant. */
export function RequestUrlBar({ url }: RequestUrlBarProps) {
  return (
    <div style={styles.urlBar}>
      <span style={styles.urlText}>{url}</span>
    </div>
  );
}
