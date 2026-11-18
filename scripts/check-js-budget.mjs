// JS budget check for the demo routes (spec 05-reveal-ceremony, R13).
//
// Run after `npm run build`. Adds up the gzipped size of the JavaScript each
// route loads on first visit, and fails when a route is over its budget.
//
// Two build layouts are read:
// - Next 15: `.next/app-build-manifest.json` lists each route's chunks, and
//   the sum is the same number `next build` prints as "First Load JS".
// - Next 16: that manifest is gone. A route's chunks are the root chunks in
//   `.next/build-manifest.json` plus the chunks named in the route's
//   `page_client-reference-manifest.js`. This is an approximation of First Load
//   JS and is slightly larger than the Next 15 number for the same page.
//
// Gzip level 9, kB = 1,000 bytes. Node built-ins only. No network, no write.
//
// The budgets are deliberately generous. This is a hackathon build, and the
// check exists to catch a large regression, not to police every kilobyte.

import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const BUILD_DIR = ".next";
const NEXT15_MANIFEST = join(BUILD_DIR, "app-build-manifest.json");
const NEXT16_ROOT_MANIFEST = join(BUILD_DIR, "build-manifest.json");

// `route` is the URL, `page` is the App Router page directory under src/app.
const BUDGETS = [
  { route: "/", page: "", maxKb: 160 },
  { route: "/demo", page: "demo", maxKb: 160 },
  { route: "/demo/personas/[key]", page: "demo/personas/[key]", maxKb: 260 },
  { route: "/demo/live", page: "demo/live", maxKb: 260 },
  { route: "/l/[id]", page: "l/[id]", maxKb: 260 },
];

function fail(message) {
  console.error(`check-js-budget: ${message}`);
  process.exit(1);
}

const hasNext15 = existsSync(NEXT15_MANIFEST);
const hasNext16 = existsSync(NEXT16_ROOT_MANIFEST);
if (!hasNext15 && !hasNext16) {
  fail(`${BUILD_DIR} has no build manifest. Run "npm run build" first.`);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    fail(`${file} could not be read as JSON.`);
  }
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

// The JS files a route loads on first visit, or null when the build has none.
function jsFilesFor(page) {
  if (hasNext15) {
    const key = `${page === "" ? "" : `/${page}`}/page`;
    const pages = readJson(NEXT15_MANIFEST).pages;
    if (pages === null || typeof pages !== "object") {
      fail(`${NEXT15_MANIFEST} has no "pages" object. The build output layout may have changed.`);
    }
    const files = pages[key];
    return Array.isArray(files) ? files : null;
  }
  const clientManifest = join(BUILD_DIR, "server", "app", page, "page_client-reference-manifest.js");
  if (!existsSync(clientManifest)) return null;
  const rootFiles = readJson(NEXT16_ROOT_MANIFEST).rootMainFiles ?? [];
  const text = readFileSync(clientManifest, "utf8");
  const routeChunks = [...text.matchAll(/static\/chunks\/[^"\\ ]+?\.js/g)].map((m) => m[0]);
  return [...rootFiles, ...routeChunks];
}

let failed = false;
for (const { route, page, maxKb } of BUDGETS) {
  const pageFile = join("src", "app", page, "page.tsx");
  if (!existsSync(pageFile)) {
    console.log(`skip ${route}: page not built yet (${pageFile} does not exist)`);
    continue;
  }
  const files = jsFilesFor(page);
  if (!Array.isArray(files)) {
    console.error(`FAIL ${route}: the build has no chunk list for this route.`);
    failed = true;
    continue;
  }
  const js = [...new Set(files)].filter((f) => f.endsWith(".js"));
  const bytes = js.reduce((sum, file) => sum + gzippedBytes(file), 0);
  const kb = bytes / 1000;
  const ok = kb <= maxKb;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${route}: ${kb.toFixed(1)} kB gzipped first load (budget ${maxKb} kB, ${js.length} chunks)`,
  );
  if (!ok) failed = true;
}

process.exit(failed ? 1 : 0);
