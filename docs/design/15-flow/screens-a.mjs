// Entry, Write and Press-the-seal screens.
import { read, esc, paras, groups, fpHtml, defs, envBox, envSvg, wax, sealSvg, heldGhost, soil, track, btn, statusOk, hashes, qr, LIVE, TODAY, FIG, SRC_GAS } from "./lib.mjs";

const personas = JSON.parse(read("content/personas/personas.json")).personas;
const fmt = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const how = read("src/components/how/copy.ts");
const howSections = [...how.matchAll(/title: "([^"]+)",\s*body: "([^"]+)"/g)].map((m) => ({ t: m[1], b: m[2] }));
const brand = read("src/components/brand/copy.ts");
const mapping = [...brand.matchAll(/seal: "([^"]+)",\s*revenant: "([^"]+)"/g)].map((m) => ({ s: m[1], r: m[2] }));

export const screens = [];
const add = (s) => screens.push(s);

// ---------------------------------------------------------------- Entry
add({
  id: "home", title: "Home", route: "/", state: "The landing page, resting state.",
  fixes: [9], component: "src/app/page.tsx with src/components/landing/*",
  opts: {},
  body: () => `
<div class="stage" style="padding-top:8px">
  <div style="width:min(100%,380px);margin-top:36px;position:relative">${envBox("maya", { button: false })}</div>${soil(true)}
</div>
<div class="center stack" style="margin-bottom:56px">
  <p class="eyebrow">The wax seal, resurrected.</p>
  <h1 class="hero-h">Memory rewrites itself.<br>Revenant doesn't.</h1>
  <p class="lede">Seal what you believe now, a goal, a worry, a decision. When it opens, you testify first, then read what you wrote.</p>
  <div class="row c" style="margin-top:28px">${btn("Open the demo letters", "demo.html")}</div>
  <p class="muted small">About 4 minutes · no sign-up, no passkey</p>
  <p><a class="link" href="write-empty.html">Seal your own. It opens 30 seconds after you seal it.</a></p>
</div>
<div class="mid" style="width:100%">
<section class="stack" style="margin-bottom:56px"><h2 class="h2">The ritual</h2>
<div class="steps4">
${[["Write", "A letter to your future self, plain text. Add up to three questions, answer them now, and add an optional receipt."], ["Press the seal", "Lock the letter with your passkey. The live demo locks it for 30 seconds."], ["Testify", "When it opens, write what you think you answered, before a word is shown."], ["See the receipts", "Your testimony beside what you wrote, then any numbers then and now."]].map(([a, b], i) => `<div class="panel tight"><span class="muted small">${i + 1}</span><b>${a}</b><p class="muted">${b}</p></div>`).join("")}
</div></section>
<section class="stack" style="margin-bottom:56px"><h2 class="h2">What we resurrected</h2>
<p>The French Académie des sciences has kept plis cachetés for centuries: sealed envelopes that people deposit to prove what they knew, and when.</p>
<p>A classroom time capsule works the same way: a letter to your future self, sealed and mailed back years later.</p>
<p>The seal carries the meaning: this was written then, by you, and nobody has touched it since.</p>
<p>Revenant rebuilds that envelope for the browser, and a letter in it can hold any part of life.</p></section>
<section class="stack" style="margin-bottom:56px"><h2 class="h2">What no wax seal could do</h2>
<p>A seal proves the letter wasn't changed. It can't stop your memory changing. So before you read, you testify, and Revenant never says what the gap means.</p></section>
<hr class="divider" style="margin-bottom:24px">
<section class="stack"><h2 class="h3">Built by a coven of Kiro agents</h2><p class="row"><a class="link" href="#">Browse the .kiro folder on GitHub</a><a class="link" href="#">Read how the agent loop works</a></p></section>
</div>`,
  wide: "mid",
});

add({
  id: "demo", title: "The demo letters", route: "/demo", state: "Three persona cards and the live card in one grid.",
  fixes: [9], component: "src/app/demo/page.tsx, src/components/demo/PersonaCard.tsx, LiveEntry.tsx", opts: {}, wide: "mid",
  body: () => `
<div class="center stack" style="margin-bottom:36px"><h1 class="h1">The demo letters</h1>
<p class="lede">These people are made up. Their letters were written as of a past date and prepared later as a demo. You need no passkey to open one.</p></div>
<div class="grid2">
${personas.map((p) => `<article class="panel dcard"><div class="top3">${envBox(p.key === "us-priya" ? "priya" : "maya", { button: false })}</div><div class="body2">
<h2 class="h2">${esc(p.display_name)}</h2><p class="muted">${esc(p.intro_line)}</p>
<p class="small muted">Written as of ${fmt(p.written_as_of)}<br>Opens ${fmt(p.opens_at.slice(0, 10))}</p>
${btn(`Open ${p.display_name}'s letter`, p.key === "us-maya" ? "maya-testify.html" : p.key === "us-priya" ? "priya-testify.html" : "#")}</div></article>`).join("")}
<article class="panel dcard"><div class="top3">${envBox("live", { button: false })}</div><div class="body2">
<h2 class="h2">Seal your own letter</h2><p class="muted">Write a short letter and seal it with your own passkey. The lock lasts 30 seconds, so you can open it here.</p>
${btn("Go to the live demo", "write-empty.html")}</div></article>
</div>`,
});

add({
  id: "how", title: "How the seal works", route: "/how-it-is-sealed", state: "The explainer page.", fixes: [3], component: "src/app/how-it-is-sealed/page.tsx, src/components/how/*", opts: {}, wide: "",
  body: () => `<div class="stack"><h1 class="h1">How the seal works</h1>
<table class="maptbl"><thead><tr><th>The wax seal</th><th>Revenant</th></tr></thead><tbody>${mapping.map((m) => `<tr><td>${esc(m.s)}</td><td>${esc(m.r)}</td></tr>`).join("")}</tbody></table>
${howSections.map((s) => `<section class="stack" style="margin-top:28px"><h2 class="h3">${esc(s.t)}</h2><p class="muted" style="color:var(--text)">${esc(s.b)}</p></section>`).join("")}
<p style="margin-top:28px"><a class="link" href="home.html">Back to the start</a></p></div>`,
});

add({
  id: "not-found", title: "No letter here", route: "404, and /seal while real sealing is off", state: "Plain not-found page.", fixes: [3], component: "src/app/not-found.tsx", opts: {}, wide: "",
  body: () => `<div class="center stack" style="padding-top:24px">
<div style="width:min(100%,260px);margin:0 auto">${envBox("maya", { button: false })}</div>
<h1 class="h1">No letter here</h1>
<p class="lede">This link does not match a letter. Check the link and try again.</p>
<div class="row c" style="margin-top:12px">${btn("Open the demo letters", "demo.html")}${btn("Seal a demo letter", "write-empty.html", "two")}</div></div>`,
});

// ---------------------------------------------------------------- Write
const introW = "Say where things stand today. Then ask yourself a few questions and answer them now. When it opens, you write what you remember answering first, then see what you wrote.";
const psIntro = "Each question is sealed with your answer. When the letter opens, you write what you think you answered before anything is shown. Then you see what you wrote.";
const occ = (sel) => ["The year ahead", "Work", "Family", "A decision", "A blank page"].map((o) => `<span class="pill${o === sel ? " sel" : ""}">${o}</span>`).join("");
const qrow = (n, q, a, { err = false, only = false } = {}) => `<div class="qrow${err ? " err" : ""}">
<div class="top2"><span>Question ${n}</span><a href="#">Remove</a></div>
<div class="qtext">${esc(q)}</div>
<span class="albl">Your answer, sealed with the letter</span>
<div class="ans${a ? "" : " ph"}" role="textbox" aria-multiline="true" aria-label="Answer to question ${n}"${err ? " aria-invalid=\"true\" aria-describedby=\"qe\"" : ""}>${a ? esc(a) : "Write your answer here. You will not see it again until the letter opens."}</div>
${err ? `<p class="qerr" id="qe" role="alert"><i aria-hidden="true">!</i>Question ${n} has no answer yet. Answer it or remove it.</p>` : ""}</div>`;

function deskBody({ occasion, letter, qs, receipt, check, empty }) {
  const answered = qs.filter((x) => x.a).length;
  const letterOk = !!letter;
  const sheet = `<article class="sheet">
<div class="date">${TODAY}</div><div class="sal">Dear future me,</div>
<div class="body${letter ? "" : " ph"}" role="textbox" aria-multiline="true" aria-label="Your letter">${letter ? paras(letter) : "Write whatever you want to remember about today…"}</div>
<div class="sign">— me, today</div><hr>
<div class="ps"><h2>P.S. Ask yourself, and answer</h2><p class="intro">${psIntro}</p>
${qs.map((x, i) => qrow(i + 1, x.q, x.a, { err: check && !x.a })).join("")}
<div class="another">Ask another:<div class="pl">${(empty ? ["What did I notice first this morning?", "What do I most want to remember about this week?"] : ["What do I think will be different by the day I open this?"]).map((s) => `<span class="p2">${esc(s)}</span>`).join("")}<span class="p2">Write my own</span></div></div></div></article>`;
  const rec = `<section class="panel stack"><div class="row" style="justify-content:space-between"><h2 class="h3">Tuck in a receipt</h2><span class="muted small">Optional</span></div>
<p class="muted">A number sealed with its date. When it opens, you guess it first, then see it next to today's.</p>
<div class="toggle" role="tablist"><span class="${receipt === "own" ? "" : "on"}">A public price</span><span class="${receipt === "own" ? "on" : ""}">A number of my own</span></div>
${receipt === "own" ? `<div class="formgrid"><div class="field full"><label>What is it?</label><div class="inp">My rent</div></div><div class="field"><label>Amount</label><div class="inp">9,800</div></div><div class="field"><label>Unit</label><div class="inp">SEK per month</div></div><div class="field full"><label>Where?</label><div class="inp">Uppsala</div></div></div>
<p class="muted small"><span class="selfrep">self-reported</span> Dated ${TODAY}. Marked self-reported. Revenant doesn't check it.</p>`
    : receipt === "public" ? `<div class="figrow"><div><b>Regular gasoline</b><br><span class="muted small">U.S. · week of ${FIG.us.gas.period} · EIA, series ${FIG.us.gas.series}</span></div><div class="v">$${FIG.us.gas.v}<br><span class="muted small" style="font-weight:400">${FIG.us.gas.unit}</span></div></div><div class="row"><a class="btn two small" href="#">Remove</a><a class="btn two small" href="#">Choose another</a></div>`
      : `<p class="muted">No receipt tucked in. A letter does not need one.</p><div class="row">${btn("Choose a public price", "#", "two small")}</div>`}
</section>`;
  const side = `<aside class="side"><div class="panel stack"><h2 class="h3">In the envelope</h2>
<div style="width:min(100%,220px);margin:0 auto">${envBox("live", { button: false })}</div>
<ul class="checklist"><li class="${letterOk ? "ok" : ""}"><span class="tick">${letterOk ? "✓" : ""}</span><span>The letter<small>${letterOk ? "Written" : "Not written yet"}</small></span></li>
<li class="${answered === qs.length ? "ok" : ""}"><span class="tick">${answered === qs.length ? "✓" : ""}</span><span>Questions answered<small>${answered} of ${qs.length}</small></span></li>
<li class="${receipt === "none" ? "" : "ok"}"><span class="tick">${receipt === "none" ? "" : "✓"}</span><span>A receipt<small>${receipt === "none" ? "None. Optional" : receipt === "own" ? "1 number of your own" : "1 public price"}</small></span></li></ul>
${btn("Fold it and press the seal", check ? "#" : "seal-choose.html")}
${check ? `<p class="small" role="status">Check the note on question 2, then try again.</p>` : ""}</div></aside>`;
  return `${track({ live: 0 })}<div class="stack" style="margin-bottom:28px"><h1 class="h1">Write to the you who opens this.</h1><p class="lede">${introW}</p>
<div><p class="lbl">Start from</p><div class="pills">${occ(occasion)}</div></div></div>
<div class="desk"><div class="stack">${sheet}${rec}</div>${side}</div>`;
}

add({ id: "write-empty", title: "Write: a blank page", route: "/demo/live (step 1)", state: "First load. One empty question row with an empty answer.", fixes: [1, 3], component: "src/components/live/desk/WriteDesk.tsx", wide: "wide", opts: {},
  body: () => deskBody({ occasion: "A blank page", letter: "", qs: [{ q: "What is on my mind right now?", a: "" }], receipt: "none", empty: true }) });
add({ id: "write-filled", title: "Write: Work, filled in", route: "/demo/live (step 1)", state: "Work, letter written, two questions answered, one public price.", fixes: [1], component: "WriteDesk.tsx, QuestionSection.tsx, QuestionRow.tsx", wide: "wide", opts: {},
  body: () => deskBody({ occasion: "Work", letter: LIVE.letter.replace("Dear future me,\n", "").replace("\n— me, today", ""), qs: [{ q: LIVE.q[0], a: LIVE.a[0] }, { q: LIVE.q[1], a: LIVE.a[1] }], receipt: "public" }) });
add({ id: "write-check", title: "Write: fold check", route: "/demo/live (step 1)", state: "Fold pressed with question 2 unanswered. Focus is on question 2's answer.", fixes: [1], component: "WriteDesk.tsx, desk/write-check.ts", wide: "wide", opts: {},
  body: () => deskBody({ occasion: "Work", letter: LIVE.letter.replace("Dear future me,\n", "").replace("\n— me, today", ""), qs: [{ q: LIVE.q[0], a: LIVE.a[0] }, { q: LIVE.q[1], a: "" }], receipt: "public", check: true }) });
add({ id: "write-own-number", title: "Write: a number of my own", route: "/demo/live (step 1)", state: "The own-number receipt view.", fixes: [1], component: "desk/OwnNumberView.tsx, ReceiptPanel.tsx", wide: "wide", opts: {},
  body: () => deskBody({ occasion: "Work", letter: LIVE.letter.replace("Dear future me,\n", "").replace("\n— me, today", ""), qs: [{ q: LIVE.q[0], a: LIVE.a[0] }, { q: LIVE.q[1], a: LIVE.a[1] }], receipt: "own" }) });

// ---------------------------------------------------------------- Press the seal
const stepsHtml = (s1, s2, a, b) => `<ol class="psteps"><li class="${s1}"><span class="n">${s1 === "done" ? "✓" : 1}</span><span>Make your passkey${a ? `<br><small>${a}</small>` : ""}</span></li><li class="${s2}"><span class="n">${s2 === "done" ? "✓" : 2}</span><span>Set the seal${b ? `<br><small>${b}</small>` : ""}</span></li></ol>`;
const sealPara = `<p class="lede">You'll press the wax twice: once to make your passkey, once to set the seal. The passkey is named "Revenant demo" in your passkey manager.</p>`;
const cardOpt = (sel, inner = "") => `<div class="option${sel ? " sel" : ""}"><div class="r"><span class="radio"></span><div class="stack" style="margin-top:0;width:100%"><b>Download a backup key card</b><p class="muted">A small image with a QR code. It opens the letter if the passkey is gone.</p>${inner}</div></div></div>`;
const skipOpt = (sel, inner = "") => `<div class="option${sel ? " sel" : ""}"><div class="r"><span class="radio"></span><div class="stack" style="margin-top:0;width:100%"><b>Skip it. A lost passkey means a lost letter.</b><p class="muted">Fine for a 30-second rehearsal.</p>${inner}</div></div></div>`;
const backupCardMini = `<div class="paper" style="padding:14px 16px;display:grid;grid-template-columns:96px 1fr;gap:14px;align-items:center;font-size:17px"><div style="background:#fff;padding:5px;width:96px;height:96px">${qr}</div><div><span class="tag">Your backup key</span><br><span style="font:700 14px ui-monospace,monospace;word-break:break-all">KM7Q-X2PD-9RTA-W4HC-J8VN-3EYL</span></div></div>
<p class="muted small">Sample key, for this prototype only.</p><div class="row">${btn("Save the card as an image", "#", "two small")}</div>`;
const warnBox = `<div class="warn"><p><b>A lost or deleted passkey means this letter can never be opened, unless you also keep its backup key.</b> Revenant cannot recover it.</p></div>`;
const crossDev = `<details><summary class="link" style="cursor:pointer">Opening on another device</summary><p class="muted" style="margin-top:8px">A passkey may not work on a device from a different ecosystem. To open this letter, use a device that has the passkey, or your computer's "use a phone" option.</p></details>`;
const sealTail = (opts) => `<fieldset style="border:0;padding:0;margin:0" class="stack"><legend class="h3" style="margin-bottom:12px;padding:0">If you lose this passkey</legend>${opts}</fieldset>${warnBox}<div class="stack">${crossDev}<p><a class="link" href="write-filled.html">Back to the letter</a></p></div>`;

function sealBody({ wax: wopts, status, steps, opts, extra = "", notice = "" }) {
  return `${track({ live: 1 })}<div class="stack center" style="margin-bottom:8px"><h1 class="h1">Press the seal.</h1>${sealPara}</div>
${notice}<div class="stage"><div class="fold-env" style="width:min(100%,340px)">${envBox("live", wopts)}</div>${soil()}</div>
<div class="center stack" style="align-items:center;display:flex;flex-direction:column;margin-top:-6px"><p class="status" role="status">${status}</p>${steps}</div>
${extra}<div class="stack" style="margin-top:36px">${sealTail(opts)}</div>`;
}
add({ id: "seal-choose", title: "Press the seal: choose a backup", route: "/demo/live (step 2)", state: "Before a backup choice. The wax is at 35% with its relief.", fixes: [4], component: "src/components/live/seal-step/SealStep.tsx, press/PressEnvelope.tsx, BackupChoice.tsx", wide: "", opts: {},
  body: () => sealBody({ wax: { off: true }, status: "Choose a backup option first.", steps: stepsHtml("", "", "", ""), opts: cardOpt(false) + skipOpt(false) }) });
add({ id: "seal-step-1", title: "Press the seal: first press", route: "/demo/live (step 2)", state: "Backup chosen (skip, with the warning confirmed). Ready for the first press.", fixes: [4], component: "SealStep.tsx, PressEnvelope.tsx", wide: "", opts: {},
  body: () => sealBody({ wax: {}, status: "Press the wax to make your passkey.", steps: stepsHtml("now", "", "", ""), opts: cardOpt(false) + skipOpt(true, `<label style="display:flex;gap:10px;align-items:flex-start"><span class="tick" style="flex:none;width:22px;height:22px;border:2px solid var(--text);border-radius:4px;display:grid;place-items:center;background:var(--text);color:var(--bg);font-size:14px">✓</span><span>I understand that a lost or deleted passkey means this letter can never be opened, unless I keep its backup key.</span></label>`) }) });
add({ id: "seal-step-2", title: "Press the seal: second press", route: "/demo/live (step 2)", state: "Passkey made. The second press is the next action.", fixes: [4], component: "SealStep.tsx, press/press-status", wide: "", opts: {},
  body: () => sealBody({ wax: {}, status: "Your device will ask once more to set the seal. Press the wax.", steps: stepsHtml("done", "now", "Passkey made", ""), opts: cardOpt(true, "<p class=\"muted small\">Backup card saved.</p>") + skipOpt(false) }) });
add({ id: "seal-sealing", title: "Press the seal: sealing", route: "/demo/live (step 2)", state: "Sealing in progress. The wax is shown pressed.", fixes: [4], component: "SealStep.tsx", wide: "", opts: {},
  body: () => sealBody({ wax: { pressed: true }, status: "Sealing your letter.", steps: stepsHtml("done", "now", "Passkey made", "Sealing your letter."), opts: cardOpt(true, "<p class=\"muted small\">Backup card saved.</p>") + skipOpt(false) }) });
add({ id: "seal-backup", title: "Press the seal: backup card", route: "/demo/live (step 2)", state: "'Download a backup key card' chosen, card ready to save.", fixes: [4], component: "BackupChoice.tsx, BackupKeyCard.tsx", wide: "", opts: {},
  body: () => sealBody({ wax: {}, status: "Press the wax to make your passkey.", steps: stepsHtml("now", "", "", ""), opts: cardOpt(true, backupCardMini) + skipOpt(false) }) });
add({ id: "seal-no-prf", title: "Press the seal: no passkey key", route: "/demo/live (step 2)", state: "The passkey can't make a key. The backup key is now required. The wax waits for the key to be saved.", fixes: [4], component: "BackupFallback.tsx, SealFailure.tsx", wide: "", opts: {},
  body: () => `${track({ live: 1 })}<div class="stack center" style="margin-bottom:12px"><h1 class="h1">Press the seal.</h1></div>
<div class="note stack" role="alert"><b>This device cannot lock a letter with a passkey</b><p class="muted">Your letter has not been sealed, and none of its text was sent to Revenant. Seal it with a backup key instead.</p></div>
<div class="stage" style="margin-top:12px"><div style="width:min(100%,300px)">${envBox("live", { off: true })}</div>${soil()}</div>
<p class="status" role="status" style="margin-top:-6px">Save the key and tick the box. Then press the wax.</p>
<section class="panel stack" style="margin-top:24px"><h2 class="h3">Your backup key</h2><p>This key is the only way to open this letter. Save it somewhere safe.</p>
<div class="inp" style="font:700 18px ui-monospace,monospace;word-break:break-all">KM7Q-X2PD-9RTA-W4HC-J8VN-3EYL</div><p class="muted small">Sample key, for this prototype only.</p>
<p><b>A lost key means a lost letter. Revenant cannot recover it.</b></p><label style="display:flex;gap:10px;align-items:center"><span style="flex:none;width:22px;height:22px;border:2px solid var(--line);border-radius:4px"></span>I have saved this key</label>
<div class="row"><a class="btn two small" href="#">Copy</a><a class="btn text small" href="write-filled.html">Not now</a></div>
<p class="muted small">Other options: try another device or browser, or open a persona letter.</p></section>` });
add({ id: "seal-failed", title: "Press the seal: failed", route: "/demo/live (step 2)", state: "Sealing failed because the live demo is busy.", fixes: [4], component: "SealFailure.tsx", wide: "", opts: {},
  body: () => `${track({ live: 1 })}<div class="stack center" style="margin-bottom:12px"><h1 class="h1">Nothing was sealed</h1></div>
<div class="stage"><div style="width:min(100%,300px)">${envBox("live", { off: true })}</div>${soil()}</div>
<div class="note stack" role="alert" style="margin-top:-6px"><b>The live demo is busy right now.</b><p>Nothing was sealed. Try again later. Your letter is still here.</p></div>
<div class="row c" style="margin-top:24px">${btn("Try again", "seal-choose.html")}<a class="btn two" href="write-filled.html">Back to the letter</a></div>` });
