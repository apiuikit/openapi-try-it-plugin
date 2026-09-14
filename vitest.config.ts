import { defineConfig } from "vitest/config";

export default defineConfig({
  // `apiuikit` is linked from a local checkout during development, and Vite
  // resolves a linked package's bare imports from its real path — so the
  // renderer would load the checkout's React while a test loads this
  // package's, and any component test dies on "Invalid hook call". Keeping
  // one copy of each is what makes rendering against the local lib work.
  resolve: { dedupe: ["react", "react-dom", "react/jsx-runtime"] },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
