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
  // tsconfig pins `jsx: "preserve"` for the Next.js build, which leaves JSX
  // untransformed. Vitest has no such build step, so tell Vite 8's Oxc pass to
  // compile JSX with React's automatic runtime (react/jsx-runtime). This is
  // test-only and does not touch the Next.js build.
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
});
