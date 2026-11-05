// Bundles the Fetch_Job entry into scripts/fetch-figures.mjs with esbuild (spec
// 08-judge-polish, task 16; design.md "The daily figure fetch"). It follows the
// same pattern as scripts/seal-personas.build.mjs: one self-contained ESM file, with
// postgres, drizzle-orm, zod and the spreadsheet parser bundled in, so the CronJob
// runs `node scripts/fetch-figures.mjs` from the app image with no extra install.
//
// The metafile check fails the build if the output still imports anything that is
// not a Node built-in, so "one file, no node_modules" is checked, not assumed.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { isBuiltin } from "node:module";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(root, "scripts/fetch-figures.ts");
const outfile = resolve(root, "scripts/fetch-figures.mjs");

const result = await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile,
  sourcemap: false,
  legalComments: "none",
  metafile: true,
  // Define require under ESM so any CommonJS dependency bundled in still works.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});

// Fail if the bundle still imports anything that is not a Node built-in.
const offenders = new Set();
for (const output of Object.values(result.metafile?.outputs ?? {})) {
  for (const imported of output.imports ?? []) {
    const name = imported.path;
    const builtin =
      name.startsWith("node:") || isBuiltin(name.replace(/^node:/, ""));
    if (!builtin) offenders.add(name);
  }
}

if (offenders.size > 0) {
  console.error(
    `fetch-figures.build: bundle has non-built-in imports: ${[...offenders]
      .sort()
      .join(", ")}`,
  );
  process.exit(1);
}

console.log("fetch-figures.build: wrote scripts/fetch-figures.mjs");
