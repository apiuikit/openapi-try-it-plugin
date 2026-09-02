import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [react(), dts({ rollupTypes: false })],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "OpenApiTryItPlugin",
      fileName: (format) => `openapi-try-it-plugin.${format === "es" ? "es.js" : "cjs.js"}`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // Never bundle apiuikit or React — apiuikit/plugin's useDocumentContext
      // must resolve to the same context instance the host app's own
      // `apiuikit` import provides. See apiuikit-website's plugins.md
      // "Publishing" section for why this matters.
      external: ["apiuikit", "apiuikit/plugin", "react", "react-dom", "react/jsx-runtime"],
    },
  },
});
