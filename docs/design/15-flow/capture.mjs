// Captures every screen at 1440x900 and 390x844 (full page), runs the layout and
// contrast checks, and records the visible strings of each screen.
// Run from the repo root:  node docs/design/15-flow/build.mjs && node docs/design/15-flow/capture.mjs
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const screens = JSON.parse(readFileSync(dir + "screens.json", "utf8"));
mkdirSync(dir + "shots", { recursive: true });
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

const probe = () => {
  const out = { hscroll: false, contrast: [], clipped: [], overlap: [], primaryBottom: null, strings: [] };
  out.hscroll = document.documentElement.scrollWidth > window.innerWidth + 1;
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== "none") return { gradient: true }; const c = parse(cs.backgroundColor); if (c && c.a > 0.9) return c; } return { r: 11, g: 9, b: 18, a: 1 }; };
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const leaves = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.nodeValue.replace(/\s+/g, " ").trim();
    const el = n.parentElement;
    if (!t || !el || el.closest("script,style,.svgdefs,.sr")) continue;
    if (!visible(el)) continue;
    if (el.closest("details:not([open])") && !el.closest("summary")) continue;
    out.strings.push(t);
    const cs = getComputedStyle(el);
    const fg = parse(cs.color); const bg = bgOf(el);
    if (bg.gradient) { out.contrast.push({ t: t.slice(0, 40), why: "text on gradient/image" }); }
    else if (fg) {
      const a = fg.a; const mix = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
      const L1 = lum(mix), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight) >= 700;
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      if (ratio < need) out.contrast.push({ t: t.slice(0, 40), ratio: +ratio.toFixed(2), need });
    }
    leaves.push({ el, t });
  }
  // clipped text
  document.querySelectorAll("body *").forEach((el) => { const cs = getComputedStyle(el); if ((cs.overflow === "hidden" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1 && !el.closest(".stage,.svgdefs") && el.textContent.trim()) out.clipped.push(el.className || el.tagName); });
  // overlapping text boxes
  const seen = new Set();
  const els = [...new Set(leaves.map((l) => l.el))];
  const rects = els.map((e) => { const range = document.createRange(); range.selectNodeContents(e); return { e, r: range.getBoundingClientRect() }; });
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.e.contains(b.e) || b.e.contains(a.e) || a.e.closest(".btns") || b.e.closest(".btns")) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 3 && oy > 3) { const k = a.e.textContent.slice(0, 20) + "|" + b.e.textContent.slice(0, 20); if (!seen.has(k)) { seen.add(k); out.overlap.push(k); } }
  }
  const prim = document.querySelector(".btn:not(.two):not(.text), .wax:not(.off)");
  if (prim) { const r = prim.getBoundingClientRect(); out.primaryBottom = Math.round(r.bottom + window.scrollY); }
  return out;
};

const browser = await chromium.launch();
const report = []; const strings = {};
for (const s of screens) {
  strings[s.id] = [];
  for (const [name, vp] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: "reduce", deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`file://${dir}${s.id}.html?bare`);
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(probe);
    await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, await page.evaluate(() => document.documentElement.scrollHeight)) });
    await page.screenshot({ path: `${dir}shots/${s.id}-${name}.png`, fullPage: true });
    for (const t of r.strings) if (!strings[s.id].includes(t)) strings[s.id].push(t);
    const issues = [];
    if (r.hscroll) issues.push("horizontal scroll");
    r.contrast.forEach((c) => issues.push("contrast " + JSON.stringify(c)));
    r.clipped.forEach((c) => issues.push("clipped " + c));
    r.overlap.forEach((c) => issues.push("overlap " + c));
    report.push({ id: s.id, name, primaryBottom: r.primaryBottom, issues });
    await ctx.close();
  }
}
await browser.close();
writeFileSync(dir + "strings.json", JSON.stringify(strings, null, 1));
for (const r of report) if (r.issues.length) console.log(r.id, r.name, "primary@" + r.primaryBottom, "\n   " + r.issues.join("\n   "));
console.log("primary action bottoms (viewport height 900 / 844):");
console.log(report.map((r) => `${r.id}/${r.name}:${r.primaryBottom}`).join("  "));
