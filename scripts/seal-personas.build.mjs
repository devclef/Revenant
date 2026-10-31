// Bundles the persona-sealing script into dist/seal-personas.mjs with esbuild.
// Run by `npm run build` (after `next build`) and directly in CI/validation.
//
// The entry (scripts/seal-personas.ts) and its virtual module are added by
// later tasks in this spec. Until the entry exists, this build is a no-op so
// that `npm run build` stays green; once it lands, the real bundle is produced.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(root, "scripts/seal-personas.ts");

if (!existsSync(entry)) {
  console.log(
    "seal-personas.build: scripts/seal-personas.ts not present yet; skipping bundle.",
  );
  process.exit(0);
}

await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: resolve(root, "dist/seal-personas.mjs"),
});
