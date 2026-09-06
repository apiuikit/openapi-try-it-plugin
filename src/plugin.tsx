import { definePlugin } from "apiuikit/plugin";
import { createTryItButton } from "./components/TryItButton";
import { createTryItPanel } from "./TryItPanel";
import type { TryItPluginOptions } from "./types";

/** Builds the "Try it" tab plugin — fills `openapi.operation.tab` with a
 * full request-sending panel alongside the built-in "Reference" tab. Takes
 * options (currently just an optional `proxyUrl` for routing around CORS)
 * rather than being a static default export, since a host app may need to
 * configure it before registering.
 *
 * Deliberately independent of `createTryItButtonPlugin` below — each fills
 * exactly one slot, so a host registers whichever it wants (one, both, or
 * neither) instead of getting both slots filled as a package deal. */
export function createTryItPlugin(options: TryItPluginOptions = {}) {
  return definePlugin({
    name: "@apiuikit/openapi-try-it-plugin/tab",
    slots: {
      "openapi.operation.tab": {
        label: "Try it",
        component: createTryItPanel(options),
      },
    },
  });
}

/** Builds the "Try it" reference-button plugin — fills
 * `openapi.operation.reference.supplementary` with a button that opens the
 * same request-sending panel in a modal, instead of a dedicated tab. See
 * `createTryItPlugin`'s doc comment for why this is a separate plugin
 * rather than bundled into it. */
export function createTryItButtonPlugin(options: TryItPluginOptions = {}) {
  return definePlugin({
    name: "@apiuikit/openapi-try-it-plugin/reference-button",
    slots: {
      "openapi.operation.reference.supplementary": createTryItButton(options),
    },
  });
}
