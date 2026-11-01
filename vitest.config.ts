import { defineConfig } from "vitest/config";

// Vitest's bundled Vite resolves tsconfig `paths` natively, so no
// vite-tsconfig-paths plugin is needed. The deprecated plugin emits a warning
// that trips the strict test gate, so it is intentionally omitted.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Two projects so `npm test` runs everything with no extra flags. The
    // integration files share one Postgres database and TRUNCATE the same
    // tables, so they must run one at a time or Postgres reports "deadlock
    // detected". Unit tests stay parallel.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["**/node_modules/**", "src/test/integration/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/test/integration/**/*.{test,spec}.{ts,tsx}"],
          fileParallelism: false,
        },
      },
    ],
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
