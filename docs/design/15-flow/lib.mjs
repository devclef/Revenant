// Shared markup pieces for the flow prototype. Output is plain static HTML.
import { readFileSync } from "node:fs";
const A = JSON.parse(readFileSync(new URL("./assets.json", import.meta.url), "utf8"));
const root = new URL("../../../", import.meta.url);
export const read = (p) => readFileSync(new URL(p, root), "utf8");

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const paras = (t) => t.trim().split(/\n+/).map((l) => `<p>${esc(l)}</p>`).join("");
export const groups = (h) => h.match(/.{4}/g);
export const fpHtml = (h) => groups(h).map((g) => `<span>${g}</span>`).join("");

// ---- art -------------------------------------------------------------
export const defs = () => `<svg class="svgdefs" aria-hidden="true" focusable="false"><defs>
<linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#f3eeff"/><stop offset="1" stop-color="#cdb8ff"/></linearGradient>
<symbol id="seal-maya" viewBox="0 0 100 100">${A.seals.maya}</symbol>
<symbol id="seal-priya" viewBox="0 0 100 100">${A.seals.priya}</symbol>
<symbol id="seal-live" viewBox="0 0 100 100">${A.seals.live}</symbol>
</defs></svg>`;

export const hashes = A.hashes;
export const qr = A.qr;

export function sealSvg(kind) {
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#seal-${kind}"/></svg>`;
}

// Ghost: the drawing from Ghost.tsx (same path, folds, eyes), no wrapper layers.
export function ghostSvg() {
  const g = A.ghost;
  return `<svg class="g" viewBox="${g.viewBox}" aria-hidden="true" focusable="false"><path d="${g.body}" fill="url(#gg)"/><path d="${g.folds}" fill="none" stroke="#b9a2f5" stroke-width="2" stroke-opacity=".35"/>${g.eyes.map((e) => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${g.eyeR.rx}" ry="${g.eyeR.ry}" fill="#0b0912"/>`).join("")}</svg>`;
}

// Envelope: back face (flap down) from Envelope.tsx, with NO dirt band.
export function envSvg(sealKind /* null = no seal drawn */) {
  const W = 300, H = 188, X = 6, Y = 6, BW = 288, BH = 176;
  const body = `<rect x="${X}" y="${Y}" width="${BW}" height="${BH}" rx="8" fill="#f1e4c8" stroke="#cdb98f"/>`;
  const fold = (d) => `<path d="${d}" fill="#e6d6b4" stroke="#cdb98f" stroke-width=".8"/>`;
  const folds = fold(`M${X} ${Y} L150 100 L${X} ${Y + BH} Z`) + fold(`M${X + BW} ${Y} L150 100 L${X + BW} ${Y + BH} Z`) + fold(`M${X} ${Y + BH} L150 100 L${X + BW} ${Y + BH} Z`);
  const flap = `<path d="M${X} ${Y} L${X + BW} ${Y} L150 104 Z" fill="#ecdcba" stroke="#c9b58a" stroke-width="1"/>`;
  let tear = `M${X} ${Y + BH}`;
  const sw = BW / 12;
  for (let i = 0; i < 12; i++) { tear += ` L${(X + sw * (i + 0.5)).toFixed(2)} ${(Y + BH - (i % 2 ? 1.5 : 4)).toFixed(2)} L${(X + sw * (i + 1)).toFixed(2)} ${Y + BH}`; }
  const seal = sealKind ? `<use href="#seal-${sealKind}" x="118" y="72" width="64" height="64"/>` : "";
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">${body}${folds}${flap}<path d="${tear}" fill="none" stroke="#b8a27a" stroke-width="1"/>${seal}</svg>`;
}

// A pressable (or off) wax, in front of an envelope. size is set by CSS (--wax).
export function wax(kind, { off = false, pressed = false, label = "Press the wax" } = {}) {
  return `<button class="wax${off ? " off" : ""}${pressed ? " pressed" : ""}" type="button" aria-label="${esc(label)}"${off ? ' aria-disabled="true"' : ""}>${sealSvg(kind)}</button>`;
}

// size: sm | md | lg. waxKind: draws a pressable wax over the held envelope (md/lg), or an inline tiny seal (sm).
export function heldGhost(size, kind, waxOpts) {
  const env = size === "sm" ? envSvg(kind) : envSvg(null);
  const w = size === "sm" ? "" : wax(kind, waxOpts || {});
  return `<div class="ghost-held ${size}">${ghostSvg()}<div class="env sealgroup${size === "lg" ? " press" : ""}">${env}${w}</div></div>`;
}
export const soil = (wide) => `<div class="soil${wide ? " wide" : ""}" aria-hidden="true"></div>`;

// A free-standing envelope with its wax, for pages without the ghost.
export function envBox(kind, { off = false, pressed = false, button = true, label } = {}) {
  const w = button ? wax(kind, { off, pressed, label }) : `<span class="wax" style="pointer-events:none">${sealSvg(kind)}</span>`;
  return `<div class="envbox sealgroup${button ? " press" : ""}">${envSvg(null)}${w}</div>`;
}

// ---- top bar ----------------------------------------------------------
const ic = {
  calm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 9c3-3 6-3 9 0s6 3 9 0M3 15c3-3 6-3 9 0s6 3 9 0"/></svg>`,
  sound: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9a4 4 0 0 1 0 6"/></svg>`,
  skip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5l9 7-9 7zM18 5v14"/></svg>`,
};
export function topbar({ persona, sound, skip }) {
  return `<header class="top">
<a class="brand" href="index.html" title="Back to the prototype index"><span class="word">revenant</span><span class="chip">Demo</span></a>
${persona ? `<p class="notice">${esc(persona)}</p>` : ""}
<button class="tbtn" type="button" aria-label="Turn off motion">${ic.calm}<span class="t">Calm</span></button>
${sound ? `<button class="tbtn" type="button" aria-label="Turn sound on">${ic.sound}<span class="t">Sound</span></button>` : ""}
<button class="tbtn${skip ? "" : " reserved"}" type="button" aria-label="Skip"${skip ? "" : ' aria-hidden="true" tabindex="-1"'}>${ic.skip}<span class="t">Skip</span></button>
</header>${persona ? `<p class="persona-strip">${esc(persona)}</p>` : ""}`;
}

// ---- step tracks ------------------------------------------------------
export const STEPS6 = ["Write", "Press the seal", "Wait", "Testify", "Break the seal", "Receipts"];
export const STEPS3 = ["Testify", "Break the seal", "Receipts"];
function trackList(steps, now, cls) {
  return `<ol class="track ${cls}" aria-label="Your progress">${steps.map((s, i) => `<li class="${i < now ? "done" : i === now ? "now" : ""}"${i === now ? ' aria-current="step"' : ""}><span class="n">${i < now ? "✓" : i + 1}</span>${esc(s)}</li>`).join("")}</ol>`;
}
function trackPhone(steps, now, cls) {
  return `<div class="track-phone ${cls}"><div class="line">Step ${now + 1} of ${steps.length} · ${esc(steps[now])}</div><div class="bars">${steps.map((_, i) => `<i class="${i < now ? "done" : i === now ? "now" : ""}"></i>`).join("")}</div></div>`;
}
// live: index 0..5 on the live demo. From 3 on, the /l/{id} three-step track is also rendered (shown with #real).
export function track({ live, three }) {
  if (three !== undefined) return trackList(STEPS3, three, "") + trackPhone(STEPS3, three, "");
  let h = trackList(STEPS6, live, "v6") + trackPhone(STEPS6, live, "v6");
  if (live >= 3) h += trackList(STEPS3, live - 3, "v3") + trackPhone(STEPS3, live - 3, "v3");
  return h;
}

export const btn = (label, href = "#", cls = "") => `<a class="btn ${cls}" href="${href}">${esc(label)}</a>`;
export const tick = (c = "✓") => `<i class="ok">${c}</i>`;
export const statusOk = (t) => `<p class="status" role="status"><span class="ok" aria-hidden="true">✓</span>${esc(t)}</p>`;

// ---- shared copy and data ---------------------------------------------
export const TODAY = "19 November 2026";
export const LIVE = {
  hash: A.hashes.live,
  link: "revenant.devclef.se/l/Qm7vXk2pTn9sLd4wRa8Hye",
  opens: "14:21:05 UTC, 19 November 2026",
  letter: `Dear future me,
This is where work stands on a Thursday in November. The team ships the quarterly release next week and I am tired, but not worried. The January project is still sitting in my inbox and I have not answered it.
I keep telling myself I will decide after the release. I know that is a way of not deciding.
Tonight I am going to cook something slow and go to bed early.
— me, today`,
  q: ["What is on my mind about work right now?", "What worries me most right now?"],
  a: [
    "The January project. I keep saying I will decide after the release.",
    "That I will say yes because it is hard to say no, and then I will have no evenings.",
  ],
  t: [
    "I think I was mostly thinking about the release, and a bit about the January project.",
    "I think I was worried about saying yes and regretting it.",
  ],
};
export const FIG = {
  us: { gas: { v: "4.269", unit: "USD per gallon", period: "26 Oct 2026", region: "U.S.", series: "EMM_EPMR_PTE_NUS_DPG", ret: "1 Nov 2026" } },
};
export const SRC_GAS = "U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices";
export const SRC_DSL = SRC_GAS;
