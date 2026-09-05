import { useEffect, useMemo, useState } from "react";
import { useDocumentContext } from "apiuikit/plugin";
import type { OpenAPIOperationPluginContext } from "apiuikit/plugin";
import { AuthPanel } from "./components/AuthPanel";
import { BinaryBodyEditor } from "./components/BinaryBodyEditor";
import { BodyEditor } from "./components/BodyEditor";
import { ExportMenu } from "./components/ExportMenu";
import { MultipartBodyEditor } from "./components/MultipartBodyEditor";
import { ParamsTable } from "./components/ParamsTable";
import { ResponseViewer } from "./components/ResponseViewer";
import { ServerVariables } from "./components/ServerVariables";
import { buildMultipartFieldRows } from "./bodyFields";
import { resolveRequestBodyMedia } from "./bodyMedia";
import { executeRequest } from "./executeRequest";
import { buildDefaultHeaderRows, buildRowsFromParameters, resolveOperationParameters } from "./paramRows";
import { buildRequest, resolveServerUrl, resolveSecurityRequirements, resolveServerVariableValues } from "./requestBuilder";
import { documentStorageKey, loadPersistedState, savePersistedState } from "./storage";
import { styles } from "./styles";
import type { CredentialMap, EditableBodyFieldRow, EditableParamRow, FetchOutcome, ServerVariableValues, TryItPluginOptions } from "./types";

/** Browsers treat `Cookie` as a forbidden request header — no script,
 * including this one, can set it via `fetch()`, so these typed-in values
 * never reach the actual request. The browser's real cookies for the
 * target origin go out automatically only when the request is same-origin
 * (fetch's default `credentials: "same-origin"`, unchanged by this plugin
 * — see `executeRequest.ts` for why forcing `"include"` was tried and
 * reverted) — e.g. through a same-origin `proxyUrl`, not a direct
 * cross-origin call to the API. */
const COOKIE_HEADER_WARNING =
  "Browsers block scripts from setting the Cookie header — these values won't be sent.";

export function createTryItPanel(options: TryItPluginOptions = {}) {
  return function TryItPanel({ document, method, path }: OpenAPIOperationPluginContext) {
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

    if (!operation) return null;

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

    return (
      <div style={styles.panel}>
        <ServerVariables
          servers={servers}
          selectedServerIndex={selectedServerIndex}
          onSelectServer={setSelectedServerIndex}
          values={serverVariables}
          onChange={setServerVariables}
        />

        <ParamsTable title="Path variables" rows={pathParams} onChange={setPathParams} />
        <ParamsTable title="Query parameters" rows={queryParams} onChange={setQueryParams} allowCustomRows />
        <ParamsTable title="Headers" rows={headerParams} onChange={setHeaderParams} allowCustomRows />
        <ParamsTable title="Cookies" rows={cookieParams} onChange={setCookieParams} allowCustomRows warning={COOKIE_HEADER_WARNING} />

        <AuthPanel
          requirements={security}
          selectedIndex={selectedSecurityIndex}
          onSelectRequirement={setSelectedSecurityIndex}
          credentials={credentials}
          onChangeCredentials={setCredentials}
        />

        {bodyMedia?.mode === "text" && (
          <BodyEditor contentType={bodyMedia.contentType} value={bodyText} onChange={setBodyText} error={bodyError} />
        )}
        {bodyMedia?.mode === "multipart" && <MultipartBodyEditor rows={multipartFields} onChange={setMultipartFields} />}
        {bodyMedia?.mode === "binary" && (
          <BinaryBodyEditor contentType={bodyMedia.contentType} file={binaryFile} onChange={setBinaryFile} />
        )}

        <div style={styles.actions}>
          <button type="button" style={styles.button} onClick={handleSend} disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </button>
          <ExportMenu
            name={operation.summary ?? operation.operationId ?? `${method.toUpperCase()} ${path}`}
            method={method}
            path={path}
            getRequest={currentRequest}
            outcome={outcome}
          />
        </div>

        <ResponseViewer outcome={outcome} sending={sending} documentedResponses={operation.responses} />
      </div>
    );
  };
}
