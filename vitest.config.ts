import { defineConfig } from "vitest/config";

// Vitest's bundled Vite resolves tsconfig `paths` natively, so no
// vite-tsconfig-paths plugin is needed. The deprecated plugin emits a warning
// that trips the strict test gate, so it is intentionally omitted.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
