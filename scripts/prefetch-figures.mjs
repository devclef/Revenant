// Launcher for `npm run prefetch` (spec 04-real-figures, task 5; design.md
// "Script entry"). It bundles scripts/prefetch-figures-main.ts with esbuild in
// memory, writes the single output under node_modules/.cache (git-ignored but
// inside the repo, so bare imports like @e965/xlsx and zod resolve against the
// repo's node_modules), then imports it so main() runs with its default
// dependencies (node:fs + process).
//
// Keep this file free of logic beyond bundle-and-import: it is ESLint-covered
// only. All behaviour lives in prefetch-figures-main.ts and the pure
// runPrefetch in src/lib/sources/prefetch.ts.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(root, "scripts/prefetch-figures-main.ts");
const outFile = resolve(root, "node_modules/.cache/revenant/prefetch-figures.mjs");

// Bundle the TypeScript entry in memory. `packages: "external"` keeps node_
// modules dependencies as bare imports (resolved at runtime from the repo's
// node_modules), so only our own @/* code is inlined. The @/* tsconfig paths
// map to ./src/*.
const result = await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  write: false,
  target: "node22",
  legalComments: "none",
  alias: { "@": resolve(root, "src") },
});

const [output] = result.outputFiles;
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, output.text, "utf8");

await import(pathToFileURL(outFile).href);
