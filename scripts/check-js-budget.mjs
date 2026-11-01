// JS budget check for the demo routes (spec 05-reveal-ceremony, R13).
//
// Run after `npm run build`. Reads the Next 15.5 App Router build output
// (`.next/app-build-manifest.json`), adds up the gzipped size of every unique
// JavaScript chunk a route loads on first visit, and fails when a route is over
// its budget. This is the same number `next build` prints as "First Load JS":
// gzip level 9, and kB = 1,000 bytes.
//
// Node built-ins only. No dependency, no network, no write.

import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const BUILD_DIR = ".next";
const MANIFEST = join(BUILD_DIR, "app-build-manifest.json");

// Keys are the entries in `app-build-manifest.json` (route + "/page").
const BUDGETS = [
  { route: "/", key: "/page", maxKb: 130 },
  { route: "/demo", key: "/demo/page", maxKb: 130 },
  { route: "/demo/personas/[key]", key: "/demo/personas/[key]/page", maxKb: 175 },
];

function fail(message) {
  console.error(`check-js-budget: ${message}`);
  process.exit(1);
}

if (!existsSync(MANIFEST)) {
  fail(`${MANIFEST} not found. Run "npm run build" first.`);
}

let pages;
try {
  pages = JSON.parse(readFileSync(MANIFEST, "utf8")).pages;
} catch {
  fail(`${MANIFEST} could not be read as JSON.`);
}
if (pages === null || typeof pages !== "object") {
  fail(`${MANIFEST} has no "pages" object. The build output layout may have changed.`);
}

const gzipCache = new Map();
function gzippedBytes(file) {
  let size = gzipCache.get(file);
  if (size === undefined) {
    size = gzipSync(readFileSync(join(BUILD_DIR, file)), { level: 9 }).length;
    gzipCache.set(file, size);
  }
  return size;
}

let failed = false;
for (const { route, key, maxKb } of BUDGETS) {
  const files = pages[key];
  if (!Array.isArray(files)) {
    console.error(`FAIL ${route}: no entry "${key}" in the build manifest.`);
    failed = true;
    continue;
  }
  const js = [...new Set(files)].filter((f) => f.endsWith(".js"));
  let bytes = 0;
  for (const file of js) {
    bytes += gzippedBytes(file);
  }
  const kb = bytes / 1000;
  const ok = kb <= maxKb;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${route}: ${kb.toFixed(1)} kB gzipped first load (budget ${maxKb} kB, ${js.length} chunks)`,
  );
  if (!ok) {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
