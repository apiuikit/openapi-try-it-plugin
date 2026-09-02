import { definePlugin } from "apiuikit/plugin";
import { createTryItPanel } from "./TryItPanel";
import type { TryItPluginOptions } from "./types";

/** Builds the "Try it" plugin. Takes options (currently just an optional
 * `proxyUrl` for routing around CORS) rather than being a static default
 * export, since a host app may need to configure it before registering. */
export function createTryItPlugin(options: TryItPluginOptions = {}) {
  return definePlugin({
    name: "@apiuikit/openapi-try-it-plugin",
    slots: {
      "openapi.operation.tab": {
        label: "Try it",
        component: createTryItPanel(options),
      },
    },
  });
}
