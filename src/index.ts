import { createTryItButtonPlugin, createTryItPlugin } from "./plugin";

export { createTryItButtonPlugin, createTryItPlugin };
export default createTryItPlugin();

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
