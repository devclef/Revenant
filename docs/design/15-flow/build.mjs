// Writes one HTML file per screen plus index.html. Run: node docs/design/15-flow/build.mjs
import { writeFileSync } from "node:fs";
import { screens } from "./screens-a.mjs";
import "./screens-b.mjs";
import { esc, defs, topbar } from "./lib.mjs";

const ORDER = ["home","demo","how","not-found","write-empty","write-filled","write-check","write-own-number","seal-choose","seal-step-1","seal-step-2","seal-sealing","seal-backup","seal-no-prf","seal-failed","wait-counting","wait-ready","still-sealed","unlock","unlock-backup","unlock-error","emergence","testify-text","testify-number","testify-last","break","receipts-live","maya-testify","maya-break","maya-receipts","maya-tampered","priya-testify","priya-receipts","letter-card","backup-card"];
const byId = Object.fromEntries(screens.map((s) => [s.id, s]));
const list = ORDER.map((id) => { if (!byId[id]) throw new Error("missing " + id); return byId[id]; });

list.forEach((s, i) => {
  const prev = list[i - 1], next = list[i + 1];
  const o = s.opts || {};
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.title)} · Revenant flow prototype</title><link rel="stylesheet" href="flow.css"></head>
<body>
<nav class="proto" aria-label="Prototype"><span class="id">${s.id} · ${esc(s.title)} · ${esc(s.route)}</span>${prev ? `<a href="${prev.id}.html">← ${prev.id}</a>` : ""}<a href="index.html">index</a>${next ? `<a href="${next.id}.html">${next.id} →</a>` : ""}<a href="#" id="track-toggle">toggle /l/{id} track</a></nav>
${defs()}
${topbar({ persona: o.persona, sound: o.sound, skip: o.skip })}
<main class="main ${s.wide || ""}" id="main">${s.body()}</main>
<script src="flow.js"></script></body></html>`;
  writeFileSync(new URL(`./${s.id}.html`, import.meta.url), html);
});

const groupsOf = [["Entry", 0, 4], ["Write", 4, 8], ["Press the seal", 8, 15], ["Wait", 15, 17], ["Opening", 17, 27], ["Personas", 27, 33], ["Keepsakes", 33, 35]];
const idx = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Revenant flow prototype</title>
<link rel="stylesheet" href="flow.css"><style>.ix{max-width:1280px;margin:0 auto;padding:24px}.thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px}.thumbs a{text-decoration:none;display:block}.thumbs img{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;border:1px solid var(--panel-line);border-radius:8px;background:#000}.thumbs b{display:block;margin-top:6px}.thumbs span{color:var(--muted);font-size:14px}</style></head><body class="bare">
<div class="ix"><h1 class="h1">Revenant: the whole flow</h1><p class="lede" style="margin:8px 0 24px">Design 15. Every screen in flow order. Open a screen and use the bar at its top to step through.</p>
${groupsOf.map(([n, a, b]) => `<h2 class="h2" style="margin:28px 0 12px">${n}</h2><div class="thumbs">${list.slice(a, b).map((s, k) => `<a href="${s.id}.html"><img src="shots/${s.id}-desktop.png" alt="" loading="lazy"><b>${a + k + 1}. ${s.id}</b><span>${esc(s.title)}</span></a>`).join("")}</div>`).join("")}</div></body></html>`;
writeFileSync(new URL("./index.html", import.meta.url), idx);
writeFileSync(new URL("./screens.json", import.meta.url), JSON.stringify(list.map(({ id, title, route, state, fixes, component }) => ({ id, title, route, state, fixes, component })), null, 1));
console.log("built", list.length, "screens");
