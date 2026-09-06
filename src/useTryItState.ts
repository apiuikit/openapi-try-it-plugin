import { useEffect, useMemo, useState } from "react";
import { useDocumentContext } from "apiuikit/plugin";
import type { OpenAPIOperationPluginContext } from "apiuikit/plugin";
import { buildMultipartFieldRows } from "./bodyFields";
import { resolveRequestBodyMedia } from "./bodyMedia";
import { executeRequest } from "./executeRequest";
import { buildDefaultHeaderRows, buildRowsFromParameters, resolveOperationParameters } from "./paramRows";
import { buildRequest, resolveServerUrl, resolveSecurityRequirements, resolveServerVariableValues } from "./requestBuilder";
import { documentStorageKey, loadPersistedState, savePersistedState } from "./storage";
import type { CredentialMap, EditableBodyFieldRow, EditableParamRow, FetchOutcome, ServerVariableValues, TryItPluginOptions } from "./types";

/** All state and request-sending logic behind the "Try it" panel, shared by
 * every layout that renders it — the full-width tab (`TryItPanel.tsx`) and
 * the left/right split used by the reference-panel modal
 * (`TryItSplitPanel.tsx`) — so the two stay behaviorally identical and only
 * differ in how they arrange the same pieces on screen. */
export function useTryItState(options: TryItPluginOptions, { document, method, path }: OpenAPIOperationPluginContext) {
  const { deref } = useDocumentContext();
  const operation = document.paths?.[path]?.[method];
  const servers = useMemo(() => document.servers ?? [], [document.servers]);
  const documentKey = useMemo(
    () => documentStorageKey(document.info?.title, document.info?.version),
    [document.info?.title, document.info?.version],
  );

  const parameters = useMemo(() => resolveOperationParameters(document, method, path), [document, method, path]);
  const security = useMemo(() => resolveSecurityRequirements(document, operation), [document, operation]);
  // `deref` intentionally excluded from deps, same as elsewhere in this
  // file — it's ambient context from `useDocumentContext()`, not expected
  // to change independently of the document itself.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bodyMedia = useMemo(() => resolveRequestBodyMedia(operation?.requestBody, deref), [operation?.requestBody]);

  const persisted = useMemo(() => loadPersistedState(documentKey), [documentKey]);

  const [selectedServerIndex, setSelectedServerIndex] = useState(0);
  const [serverVariables, setServerVariables] = useState<ServerVariableValues>(() =>
    resolveServerVariableValues(servers[0], persisted.serverVariables),
  );

  const [pathParams, setPathParams] = useState<EditableParamRow[]>(() => buildRowsFromParameters(parameters, "path", deref));
  const [queryParams, setQueryParams] = useState<EditableParamRow[]>(() => buildRowsFromParameters(parameters, "query", deref));
  const [headerParams, setHeaderParams] = useState<EditableParamRow[]>(() => [
    ...buildDefaultHeaderRows(operation),
    ...buildRowsFromParameters(parameters, "header", deref),
  ]);
  const [cookieParams, setCookieParams] = useState<EditableParamRow[]>(() => buildRowsFromParameters(parameters, "cookie", deref));

  const [selectedSecurityIndex, setSelectedSecurityIndex] = useState(0);
  const [credentials, setCredentials] = useState<CredentialMap>(persisted.credentials);

  const [bodyText, setBodyText] = useState(() => (bodyMedia?.example !== undefined ? JSON.stringify(bodyMedia.example, null, 2) : ""));
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [multipartFields, setMultipartFields] = useState<EditableBodyFieldRow[]>(() =>
    bodyMedia?.mode === "multipart" ? buildMultipartFieldRows(bodyMedia.schema, deref) : [],
  );
  const [binaryFile, setBinaryFile] = useState<File | null>(null);

  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<FetchOutcome | null>(null);

  // Re-seed every field when the operation changes (the panel is reused
  // across tab switches, but its state shouldn't leak between operations).
  useEffect(() => {
    setPathParams(buildRowsFromParameters(parameters, "path", deref));
    setQueryParams(buildRowsFromParameters(parameters, "query", deref));
    setHeaderParams([...buildDefaultHeaderRows(operation), ...buildRowsFromParameters(parameters, "header", deref)]);
    setCookieParams(buildRowsFromParameters(parameters, "cookie", deref));
    setSelectedSecurityIndex(0);
    setBodyText(bodyMedia?.example !== undefined ? JSON.stringify(bodyMedia.example, null, 2) : "");
    setBodyError(null);
    setMultipartFields(bodyMedia?.mode === "multipart" ? buildMultipartFieldRows(bodyMedia.schema, deref) : []);
    setBinaryFile(null);
    setOutcome(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, path]);

  useEffect(() => {
    savePersistedState(documentKey, { credentials, serverVariables });
  }, [documentKey, credentials, serverVariables]);

  useEffect(() => {
    const server = servers[selectedServerIndex] ?? servers[0];
    setServerVariables(resolveServerVariableValues(server, loadPersistedState(documentKey).serverVariables));
  }, [selectedServerIndex, servers, documentKey]);

  function currentRequest() {
    const baseUrl = resolveServerUrl(servers[selectedServerIndex] ?? servers[0], serverVariables);
    return buildRequest({
      method,
      baseUrl,
      path,
      pathParams,
      queryParams,
      headerParams,
      cookieParams,
      security: security[selectedSecurityIndex] ?? null,
      credentials,
      bodyMode: bodyMedia?.mode,
      bodyText,
      bodyContentType: bodyMedia?.contentType,
      multipartFields,
      binaryFile,
    });
  }

  async function handleSend() {
    if (bodyMedia?.mode === "text" && bodyMedia.contentType && bodyText.trim().length > 0) {
      const isJsonBody = /^(application\/json|[\w.-]+\+json)(?:\s*;|$)/i.test(bodyMedia.contentType);
      if (isJsonBody) {
        try {
          JSON.parse(bodyText);
        } catch (error) {
          setBodyError(error instanceof Error ? `Invalid JSON body: ${error.message}` : "Invalid JSON body");
          return;
        }
      }
    }
    setBodyError(null);

    setSending(true);
    setOutcome(null);
    try {
      const result = await executeRequest(currentRequest(), { proxyUrl: options.proxyUrl });
      setOutcome(result);
    } finally {
      setSending(false);
    }
  }

  return {
    operation,
    method,
    path,
    servers,
    security,
    bodyMedia,
    selectedServerIndex,
    setSelectedServerIndex,
    serverVariables,
    setServerVariables,
    pathParams,
    setPathParams,
    queryParams,
    setQueryParams,
    headerParams,
    setHeaderParams,
    cookieParams,
    setCookieParams,
    selectedSecurityIndex,
    setSelectedSecurityIndex,
    credentials,
    setCredentials,
    bodyText,
    setBodyText,
    bodyError,
    multipartFields,
    setMultipartFields,
    binaryFile,
    setBinaryFile,
    sending,
    outcome,
    currentRequest,
    handleSend,
  };
}
