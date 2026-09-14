import type { OpenAPIOperationPluginContext } from "apiuikit/plugin";
import { AuthPanel } from "./components/AuthPanel";
import { BinaryBodyEditor } from "./components/BinaryBodyEditor";
import { BodyEditor } from "./components/BodyEditor";
import { ExportMenu } from "./components/ExportMenu";
import { MultipartBodyEditor } from "./components/MultipartBodyEditor";
import { ParamsTable } from "./components/ParamsTable";
import { RequestUrlBar } from "./components/RequestUrlBar";
import { ResponseViewer } from "./components/ResponseViewer";
import { SendFooter } from "./components/SendFooter";
import { ServerVariables } from "./components/ServerVariables";
import { CloseIcon } from "./components/icons";
import { color, styles } from "./styles";
import type { TryItPluginOptions } from "./types";
import { useTryItState } from "./useTryItState";

interface TryItSplitPanelProps extends OpenAPIOperationPluginContext {
  /** Renders a close button at the end of the header row. Omitted when
   * whatever hosts this panel provides its own dismissal. */
  onClose?: () => void;
}

/** Same warning as `TryItPanel.tsx` — see there for why. */
const COOKIE_HEADER_WARNING =
  "Browsers block scripts from setting the Cookie header — these values won't be sent.";

/** The same "Try it" panel as `createTryItPanel`, arranged left/right
 * instead of top-to-bottom: request-building on the left, the response on
 * the right, each scrolling independently — for the reference-panel
 * button's modal (`TryItButton.tsx`), which has a fixed height rather than
 * the tab's free-flowing page column. Built on the same `useTryItState`
 * hook as the tab layout, so behavior (persistence, validation, sending)
 * stays identical between the two — only the JSX arrangement differs.
 *
 * Owns the modal's header row rather than leaving it to `TryItButton`: the
 * header shows the built request URL and opens the export menu, both of
 * which come from this component's own `useTryItState`. The caller supplies
 * only `onClose`. */
export function createTryItSplitPanel(options: TryItPluginOptions = {}) {
  return function TryItSplitPanel({ onClose, ...context }: TryItSplitPanelProps) {
    const state = useTryItState(options, context);
    const { operation, method, path } = state;
    if (!operation) return null;

    const {
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
    } = state;

    return (
      <div style={styles.splitRoot}>
        <RequestUrlBar variant="header" method={method} url={currentRequest().url}>
          <ExportMenu
            iconOnly
            name={operation.summary ?? operation.operationId ?? `${method.toUpperCase()} ${path}`}
            method={method}
            path={path}
            getRequest={currentRequest}
            outcome={outcome}
          />
          {onClose && (
            <button type="button" style={styles.iconAction} title="Close" aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </button>
          )}
        </RequestUrlBar>

        <div style={styles.modalBodySplit}>
          <div style={styles.splitPane}>
            <div style={styles.splitScroll}>
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
            </div>

            <SendFooter sending={sending} onSend={handleSend} />
          </div>

          <div style={{ ...styles.splitColumn, borderLeft: `1px solid ${color.border}` }}>
            <ResponseViewer outcome={outcome} sending={sending} />
          </div>
        </div>
      </div>
    );
  };
}
