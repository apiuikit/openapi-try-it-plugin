import { createTryItHeaderButton } from "./components/TryItButton";
import { createTryItButtonPlugin, createTryItPlugin } from "./plugin";

export { createTryItButtonPlugin, createTryItPlugin };
export default createTryItPlugin();

/**
 * The compact panel-header trigger apiuikit renders itself when
 * `config.show.tryIt` is on — a component, not a plugin, because the library
 * renders it directly into the side panel's header row rather than through a
 * slot. Built once at module scope: rebuilding the component per render
 * would remount the panel and drop whatever the user had typed.
 *
 * Not a plugin because there is no public header slot to fill: the header is
 * apiuikit's own chrome, and keeping it that way avoids committing that row's
 * geometry to the plugin contract. Plugin authors have the tab and Reference
 * slots — see `createTryItPlugin` / `createTryItButtonPlugin`.
 */
export const TryItHeaderButton = createTryItHeaderButton();

export type {
  ApiKeyCredential,
  BasicCredential,
  BearerCredential,
  Credential,
  CredentialMap,
  EditableParamRow,
  FetchOutcome,
  FetchResult,
  ManualTokenCredential,
  TryItPluginOptions,
} from "./types";
