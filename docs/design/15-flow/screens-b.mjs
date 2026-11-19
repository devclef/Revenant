// Wait, Opening, Personas and Keepsakes.
import { read, esc, paras, groups, fpHtml, envBox, envSvg, wax, sealSvg, heldGhost, soil, track, btn, statusOk, hashes, qr, LIVE, TODAY, FIG, SRC_GAS } from "./lib.mjs";
import { screens } from "./screens-a.mjs";
const add = (s) => screens.push(s);

const fpBlock = (h, cls = "") => `<div class="fpgrid ${cls}">${fpHtml(h)}</div>`;

// ---------------------------------------------------------------- Wait
const letterCard = () => `<div class="paper lcard"><div class="qr">${qr}</div><div class="meta"><span class="k">Letter card</span><b>Opens ${LIVE.opens}</b>
<span class="k">Your letter link</span><span class="url">${LIVE.link}</span>
<span class="k">Fingerprint at sealing</span><div class="fpsmall">${groups(LIVE.hash).map((g) => `<span class="g4">${g}</span>`).join(" ")}</div></div></div>`;
function waitBody(ready) {
  return `${track({ live: 2 })}<section class="panel stack" style="padding:28px"><div style="width:min(100%,240px);margin:0 auto">${envBox("live", { button: false })}</div>
<div class="center stack"><h1 class="h1">${ready ? "The time has come." : "Your letter is sealed"}</h1><p class="lede">It cannot be changed now.</p>
${ready ? "" : `<p class="big" role="timer" aria-live="off">18</p><p class="muted">Time remaining: 18 seconds.</p>`}
<div class="row c" style="min-height:56px;align-items:center">${ready ? btn("Open your letter", "unlock.html") : `<span class="muted">The button appears when the time is up.</span>`}</div></div>
${letterCard()}
<div class="row stackm c">${btn("Save the card as an image", "#", "two small")}${btn("Add to your calendar", "#", "two small")}</div>
<p class="muted small center">This is a rehearsal: a real letter stays sealed for months, and this one opens in 30 seconds.</p></section>`;
}
add({ id: "wait-counting", title: "Wait: counting", route: "/demo/live (step 3)", state: "Countdown running.", fixes: [5], component: "src/components/live/stepper/LiveWaitStep.tsx, SealedEnvelopeView.tsx, SealedKeepsakes.tsx, LetterCard.tsx", wide: "", opts: {}, body: () => waitBody(false) });
add({ id: "wait-ready", title: "Wait: ready", route: "/demo/live (step 3)", state: "Time is up. One action: Open your letter.", fixes: [5], component: "LiveWaitStep.tsx", wide: "", opts: {}, body: () => waitBody(true) });

// ---------------------------------------------------------------- Opening
add({ id: "still-sealed", title: "Still sealed", route: "/l/{id} before the opening date", state: "Only that the letter is sealed, and the time remaining.", fixes: [3], component: "src/components/reveal/StillSealed.tsx", wide: "", opts: {},
  body: () => `<div class="stage"><div style="width:min(100%,300px)">${envBox("live", { button: false })}</div>${soil()}</div>
<div class="center stack"><h1 class="h1">Still sealed</h1><p class="lede">This letter is still sealed. It opens on 19 February 2027.</p>
<p class="big" style="font-size:clamp(24px,4vw,34px);line-height:1.2">Time remaining: 87 days, 9 hours and 40 minutes.</p></div>` });
add({ id: "unlock", title: "Unlock", route: "/l/{id} and the live demo", state: "Unlock with the passkey or the backup key. No ghost yet.", fixes: [3], component: "src/components/live/UnlockView.tsx", wide: "", opts: { sound: true },
  body: () => `${track({ live: 3 })}<div class="stage"><div style="width:min(100%,300px)">${envBox("live", { button: false })}</div>${soil()}</div>
<div class="center stack"><h1 class="h1">Unlock your letter</h1><p class="lede">It was sealed on ${TODAY}. Use the passkey you made, or the backup key from your card.</p>
<div class="row c" style="margin-top:12px">${btn("Unlock with your passkey", "emergence.html")}<a class="btn two" href="unlock-backup.html">Use the backup key</a></div></div>` });
add({ id: "unlock-backup", title: "Unlock: backup key", route: "/l/{id} and the live demo", state: "Entering or scanning the backup key.", fixes: [3], component: "UnlockView.tsx, BackupFallback.tsx", wide: "", opts: { sound: true },
  body: () => `${track({ live: 3 })}<div class="center stack"><h1 class="h1">Use the backup key</h1><p class="lede">This letter needs its backup key. Paste it below.</p></div>
<section class="panel stack" style="margin-top:24px"><div class="field"><label>Backup key</label><div class="inp" style="font:600 18px ui-monospace,monospace">KM7Q-X2PD-9RTA-W4HC-J8VN-3EYL</div><p class="hint" style="margin-top:6px">Paste the key from your backup card.</p></div>
<p class="muted">Or scan the QR code on the card.</p>
<div class="row">${btn("Scan the QR code", "#", "two small")}${btn("Unlock with this key", "emergence.html", "small")}</div></section>
<p style="margin-top:20px" class="center"><a class="link" href="unlock.html">Use the passkey instead</a></p>` });
add({ id: "unlock-error", title: "Unlock: passkey not on this device", route: "/l/{id} and the live demo", state: "The passkey isn't here. The cross-device help shows.", fixes: [3], component: "UnlockView.tsx", wide: "", opts: { sound: true },
  body: () => `${track({ live: 3 })}<div class="stage"><div style="width:min(100%,300px)">${envBox("live", { button: false })}</div>${soil()}</div>
<div class="center stack"><h1 class="h1">Unlock your letter</h1></div>
<div class="note stack" role="alert" style="margin-top:20px"><b>This is probably not the passkey that sealed this letter. Try another.</b><p class="muted">A passkey may not work on a device from a different ecosystem. To open this letter, use a device that has the passkey, or your computer's "use a phone" option.</p></div>
<div class="row c" style="margin-top:20px">${btn("Try again", "emergence.html")}<a class="btn two" href="unlock-backup.html">Use the backup key</a></div>` });
add({ id: "emergence", title: "Emergence", route: "/l/{id} and the live demo", state: "The ghost has risen with the envelope. The seal check has passed.", fixes: [2, 3], component: "src/components/ceremony/Ceremony.tsx, scene/PersonaGhost.tsx", wide: "", opts: { sound: true },
  body: () => `${track({ live: 3 })}<div class="stage">${heldGhost("md", "live", { label: "The sealed envelope" })}${soil()}</div>
<div class="center stack">${statusOk("The seal is intact. Nothing here has changed since it was sealed.")}
<h1 class="h1">Before you read it</h1><p class="lede">You'll answer 3 questions from memory. It takes about 2 minutes.</p>
<div class="row c" style="margin-top:12px">${btn("Begin", "testify-text.html")}</div></div>` });

const ghostTop = () => `<div class="stage" style="padding-top:12px;margin-bottom:12px">${heldGhost("sm", "live")}${soil()}</div>`;
const countLine = (n, t, extra = "") => `<p class="count-line">Question ${n} of ${t}${extra}</p>`;
const btns = ({ prev, mid, next, nextHref }) => `<div class="btns">${prev ? `<a class="btn text sp" href="${prev}">Previous question</a>` : `<span class="sp cell"></span>`}${mid ? `<a class="btn two" href="#">${mid}</a>` : ""}${btn(next, nextHref)}</div>`;

add({ id: "testify-text", title: "Testify: your question", route: "/l/{id} and the live demo", state: "Author question 1 of 3.", fixes: [1, 2, 6], component: "src/components/ceremony/recall/RecallReader.tsx", wide: "", opts: { sound: true },
  body: () => `${track({ live: 3 })}${ghostTop()}<section class="panel qcard">${countLine(1, 3)}
<p class="asked">On ${TODAY} you asked yourself:</p><div class="paper"><span class="q">${esc(LIVE.q[0])}</span></div>
<div class="field"><label for="a1">What you think you answered</label><p class="hint" style="margin-bottom:8px">What did you answer? Write what you remember.</p><textarea class="ta orange" id="a1">${esc(LIVE.t[0])}</textarea><p class="count">${LIVE.t[0].length} of 1,000 characters</p></div>
${btns({ mid: "I don't remember", next: "Next question", nextHref: "testify-number.html" })}</section>` });

// The range is fixed per unit (UNIT_RANGE_TABLE in unit-ranges.ts: USD per gallon 0 to 10). It never comes from a figure or an answer.
const RANGE = { min: 0, max: 10, ticks: [0, 2, 4, 6, 8, 10] };
const scaleHtml = (val) => {
  const { min, max } = RANGE;
  const pct = val === null ? null : ((val - min) / (max - min)) * 100;
  return `<div class="scale"><div class="rail">${RANGE.ticks.map((t) => `<i class="tick" style="left:${((t - min) / (max - min)) * 100}%"></i>`).join("")}<i class="mark${pct === null ? " empty" : ""}" style="left:${pct ?? 0}%"></i></div>
<div class="ends"><span>$${min}</span><a class="link small" href="#">Zoom in to place it more exactly</a><span>$${max}</span></div>
<p class="hint" style="margin-top:8px">Drag the ink mark to where you remember it. You can also type the number, or choose no answer.</p></div>`;
};
const numField = (v, unit) => `<div class="numfield"><input value="${v}" aria-label="Your answer, from memory" inputmode="decimal"><span class="unit">${unit}</span></div>`;
function figQ({ n, t, val, last, sample, prev, asOf, mem }) {
  return `<section class="panel qcard">${countLine(n, t, ` · ${asOf}`)}
<p class="fig-q">What do you think ${sample ? "a gallon of regular gasoline" : "a gallon of regular gasoline"} cost then?</p>${mem ? `<p class="hint" style="margin-bottom:12px">${mem}</p>` : ""}
<div class="field"><label>Your answer, from memory</label>${numField(val === null ? "" : val.toFixed(2), "USD per gallon")}${sample ? `<p class="sample">A sample answer is filled in. Change it if you remember differently.</p>` : ""}</div>
${scaleHtml(val)}
${btns({ prev, mid: "No answer", next: last ? "Record my testimony" : "Next question", nextHref: last ? "break.html" : "#" })}</section>`;
}
add({ id: "testify-number", title: "Testify: a figure question", route: "/l/{id} and the live demo", state: "Question 3 of 3, a figure with the scale, before an answer is placed.", fixes: [6], component: "RecallReader.tsx, recall/NumberLine.tsx", wide: "", opts: { sound: true },
  body: () => `${track({ live: 3 })}${ghostTop()}${figQ({ n: 3, t: 3, val: null, last: true, prev: "testify-text.html", asOf: `sealed on ${TODAY}` })}` });
add({ id: "testify-last", title: "Testify: the last question", route: "/l/{id} and the live demo", state: "The last question answered. Previous question and Record my testimony.", fixes: [6], component: "RecallReader.tsx", wide: "", opts: { sound: true },
  body: () => `${track({ live: 3 })}${ghostTop()}${figQ({ n: 3, t: 3, val: 4.1, last: true, prev: "testify-number.html", asOf: `sealed on ${TODAY}` })}` });

const breakBody = (kind, extra = "", three) => `<div class="stage">${heldGhost("lg", kind, { label: "Break the seal" })}${soil(true)}</div>
<div class="center stack"><h1 class="h1">Break the seal</h1><p class="muted">Your testimony is recorded.</p>
<p>Press and hold the wax seal to break it, or use the button.</p><div class="row c">${btn("Break the seal", extra)}</div></div>`;
add({ id: "break", title: "Break the seal", route: "/l/{id} and the live demo", state: "The ghost centred, the wax large and ready to press.", fixes: [2], component: "src/components/ceremony/seal/BreakSeal.tsx, Ceremony.tsx", wide: "", opts: { sound: true },
  body: () => `${track({ live: 4 })}${breakBody("live", "receipts-live.html")}` });

// ---------------------------------------------------------------- Receipts parts
const qa = ({ q, rem, remLabel, wrote, wroteLabel, pers }) => `<div class="qa"><div class="paper"><span class="tag">${pers ? "Her question, as she wrote it" : "Your question, as you wrote it"}</span><br><span class="q">${esc(q)}</span></div>
<div class="you${pers ? " pers" : ""}"><span class="tag">${esc(remLabel)}</span><p>${esc(rem)}</p></div>
<div class="paper then"><span class="tag">${esc(wroteLabel)}</span><p>${esc(wrote)}</p></div></div>`;
const letterPaper = (text, dateLine) => `<div class="paper letterpaper"><p class="date">${esc(dateLine)}</p>${paras(text)}</div>`;
const fig = ({ name, then, now, ans, ansLabel, unit, chg, formula, same, series, retThen, retNow, tp, np }) => `<div class="fig"><p class="name">${esc(name)}</p><div class="cells">
<div class="cell"><span class="k">Then</span><div class="val">$${then}</div><p class="per">${unit} · ${tp} · U.S.</p></div>
<div class="cell"><span class="k">Now</span><div class="val">$${now}</div><p class="per">${unit} · ${np} · U.S.</p></div>
<div class="cell you2"><span class="k">${ansLabel}</span><div class="val">$${ans}</div><p class="per">${unit}</p></div></div>
${same ? `<p class="chg"><span style="font-weight:400">${esc(same)}</span></p>` : `<p class="chg">${chg}<small>Formula: ${formula}</small></p>`}
<p class="src">Source: ${SRC_GAS} · series ${series}. Then: ${retThen}. Now: ${retNow}. <a class="link" href="#">Check the source</a></p></div>`;
const sealRow = ({ hash, tamper }) => `<div class="sealrow">${statusOk("The seal is intact. Nothing here has changed since it was sealed.").replace('class="status"', 'class="status" style="justify-content:flex-start"')}
<details class="fp"><summary>Show the fingerprint</summary>${fpBlock(hash)}</details>${tamper || ""}</div>`;
const tamperBtn = `<div class="stack"><div class="row"><a class="btn two small" href="maya-tampered.html">Try to tamper with it</a></div><p class="muted small">This runs on a copy in your browser. The stored letter is not changed.</p></div>`;
const endLive = () => `<div class="endcard"><p class="h3" style="max-width:34ch">Your testimony sits beside the record. What lies between them is yours to read.</p>
<p class="muted">That is the whole letter. Nothing has been added to what you remembered, what was written, or the record.</p>
<div class="row c">${btn("Seal another letter", "write-empty.html")}<a class="btn two" href="demo.html">Back to the demo letters</a></div></div>`;
const endPersona = (noFig) => `<div class="endcard"><p class="h3" style="max-width:34ch">${noFig ? "Her testimony and her letter are side by side. What they say is yours to read." : "Your testimony sits beside the record. What lies between them is yours to read."}</p>
<p class="muted">That is the whole letter. Nothing has been added to what you remembered, what was written, or the record.</p>
<div class="row c">${btn("Seal your own. It opens 30 seconds after you seal it.", "write-empty.html")}<a class="btn two" href="demo.html">Back to the demo letters</a></div></div>`;

add({ id: "receipts-live", title: "See the receipts: live letter", route: "/l/{id} and the live demo", state: "Two answered questions, the letter, one figure in the same-week case, the seal line, the end card.", fixes: [1, 7], component: "src/components/reveal/Reveal.tsx, reveal/*", wide: "", opts: { sound: true },
  body: () => `${track({ live: 5 })}<div class="rc"><h1 class="h1">See the receipts</h1>
<section><h2 class="h2">Your questions</h2>${qa({ q: LIVE.q[0], rem: LIVE.t[0], remLabel: "You remembered, just now", wrote: LIVE.a[0], wroteLabel: `You wrote, ${TODAY}` })}${qa({ q: LIVE.q[1], rem: LIVE.t[1], remLabel: "You remembered, just now", wrote: LIVE.a[1], wroteLabel: `You wrote, ${TODAY}` })}</section>
<section><h2 class="h2">What you wrote then</h2>${letterPaper(LIVE.letter, TODAY)}</section>
<section><h2 class="h2">The numbers, then and now</h2><div class="figs">${fig({ name: "Regular gasoline", then: "4.269", now: "4.269", ans: "4.10", ansLabel: "Your answer, just now", unit: "USD per gallon", same: "Same week as when you sealed it. A letter kept for months would show the change.", series: "EMM_EPMR_PTE_NUS_DPG", retThen: "sealed with the letter, retrieved 1 Nov 2026", retNow: "retrieved 19 Nov 2026", tp: "week of 26 Oct 2026", np: "week of 26 Oct 2026" })}</div></section>
${sealRow({ hash: hashes.live })}${endLive()}</div>` });

// ---------------------------------------------------------------- Personas
const NOTICE = (n) => `${n} is fictional. This letter was prepared later as a demo.`;
const personaHead = (name) => `<div class="center phead"><h1 class="h1">${name}'s letter</h1><p class="muted small">Written as of 12 May 2024 · Opens 5 November 2024</p></div>`;
const ghostSm = (kind) => `<div class="stage" style="padding-top:8px;margin-bottom:10px">${heldGhost("sm", kind)}${soil()}</div>`;
const maya = read("content/personas/letters/us-maya.txt");
const priya = read("content/personas/letters/us-priya.txt");

add({ id: "maya-testify", title: "Maya: a figure question", route: "/demo/personas/us-maya", state: "A figure question with its sample answer, labelled as a sample.", fixes: [2, 6], component: "src/components/reveal/OpeningFlow.tsx (persona), ceremony/recall/*", wide: "", opts: { persona: NOTICE("Maya"), sound: true },
  body: () => `${track({ three: 0 })}${personaHead("Maya")}${ghostSm("maya")}${figQ({ n: 1, t: 2, val: 3.59, last: false, sample: true, asOf: "as of 12 May 2024", mem: "You lived through May 2024 too. Answer from your own memory of it.", prev: null })}` });
add({ id: "maya-break", title: "Maya: break the seal", route: "/demo/personas/us-maya", state: "The ghost centred, the wax ready to press.", fixes: [2], component: "ceremony/seal/BreakSeal.tsx", wide: "", opts: { persona: NOTICE("Maya"), sound: true },
  body: () => `${track({ three: 1 })}${breakBody("maya", "maya-receipts.html")}` });

const mayaFigs = () => `<div class="figs">${fig({ name: "A gallon of regular gasoline", then: "3.643", now: "3.069", ans: "3.59", ansLabel: "Your answer · sample answer", unit: "USD per gallon", chg: "fell −0.574 · −15.8% · 6 May 2024 to 4 Nov 2024", formula: "(3.069 − 3.643) ÷ 3.643 × 100 = −15.8%", series: "EMM_EPMR_PTE_NUS_DPG", retThen: "historical record, retrieved 1 Nov 2026", retNow: "historical record, retrieved 1 Nov 2026", tp: "week of 6 May 2024", np: "week of 4 Nov 2024" })}
${fig({ name: "A gallon of diesel", then: "3.894", now: "3.536", ans: "3.79", ansLabel: "Your answer · sample answer", unit: "USD per gallon", chg: "fell −0.358 · −9.2% · 6 May 2024 to 4 Nov 2024", formula: "(3.536 − 3.894) ÷ 3.894 × 100 = −9.2%", series: "EMD_EPD2D_PTE_NUS_DPG", retThen: "historical record, retrieved 1 Nov 2026", retNow: "historical record, retrieved 1 Nov 2026", tp: "week of 6 May 2024", np: "week of 4 Nov 2024" })}</div>`;
const mayaReceipts = (tamper) => `${track({ three: 2 })}<div class="rc"><h1 class="h1">See the receipts</h1>
<section><h2 class="h2">What she wrote, as of 12 May 2024</h2>${letterPaper(maya, "Written as of 12 May 2024")}</section>
<section><h2 class="h2">The numbers, then and now</h2>${mayaFigs()}</section>
${tamper}${endPersona(false)}</div>`;
add({ id: "maya-receipts", title: "Maya: the receipts", route: "/demo/personas/us-maya", state: "The full receipts page with two figures that changed.", fixes: [7], component: "reveal/Reveal.tsx, reveal/tamper/TamperControl.tsx", wide: "", opts: { persona: NOTICE("Maya"), sound: true },
  body: () => mayaReceipts(sealRow({ hash: hashes.maya, tamper: tamperBtn })) });
const fixedFp = "5a25def5dd62f6719db9f9bbc05fbbf210eac1fdd3d4c3018b3b97cb84a4728f";
add({ id: "maya-tampered", title: "Maya: tamper check", route: "/demo/personas/us-maya", state: "The tamper control has run on the copy and the check fails.", fixes: [7], component: "reveal/tamper/TamperControl.tsx", wide: "", opts: { persona: NOTICE("Maya"), sound: true },
  body: () => mayaReceipts(`<div class="sealrow stack"><p class="status" style="justify-content:flex-start" role="status"><svg class="crack" viewBox="0 0 100 100" aria-hidden="true"><use href="#seal-maya"/><path d="M50 4 L45 28 L57 44 L43 62 L52 96" fill="none" stroke="#4a1a00" stroke-width="3.5" stroke-linejoin="round"/></svg>The seal is cracked. Revenant refuses to open this copy.</p>
<p class="muted small">This runs on a copy in your browser. The stored letter is not changed.</p>
<div><span class="eyebrow">Where each attempt stopped</span><div class="attempts"><div><b>The one-byte change</b><p class="muted">Refused at the fingerprint check. The copy's fingerprint does not match the stored one.</p></div><div><b>The one-byte change, with its fingerprint fixed</b><p class="muted">Refused at the authentication tag check. The fingerprint matches, and the encrypted text does not.</p></div></div></div>
<details class="fp" open><summary>Show the fingerprint</summary><div class="stack"><div class="fp2"><span class="muted">Stored fingerprint</span><span>${hashes.maya}</span></div><div class="fp2"><span class="muted">Fingerprint of the copy</span><span>${fixedFp}</span></div></div></details>
<div class="row"><a class="btn two small" href="maya-receipts.html">Close</a></div></div>`) });

const PQ = ["What am I looking forward to most right now?", "What am I worried about right now?"];
const PA = [
  "The trip to the coast with my sister, even though we have not agreed how to get there. And a Sunday with nothing on the list.",
  "The extra morning shift. I keep changing my mind, and either way I am worried I will fall behind on my reading.",
];
const PR = [
  "The coast trip with my sister, mostly. I think I also wanted one quiet Sunday.",
  "I think I had already decided to say no to the extra shift. The reading list was what worried me.",
];
export const priyaCopy = { PQ, PA, PR };
add({ id: "priya-testify", title: "Priya: her recollection", route: "/demo/personas/us-priya", state: "Her fictional recollection of her answer, one question at a time.", fixes: [2, 6], component: "ceremony/recall/PersonaTestimony.tsx, OpeningFlow.tsx", wide: "", opts: { persona: NOTICE("Priya"), sound: true },
  body: () => `${track({ three: 0 })}${personaHead("Priya")}${ghostSm("priya")}<section class="panel qcard">${countLine(1, 2)}
<p class="asked">As of 12 May 2024 she asked herself:</p><div class="paper"><span class="q">${esc(PQ[0])}</span></div>
<div class="recol"><span class="tag">What she thinks she answered · fictional</span><p>${esc(PR[0])}</p></div>
${btns({ next: "Next question", nextHref: "#" })}</section>` });
add({ id: "priya-receipts", title: "Priya: the receipts", route: "/demo/personas/us-priya", state: "Her recollection beside her sealed answer for each question, then her letter.", fixes: [1, 7], component: "reveal/Reveal.tsx, reveal/tamper/TamperControl.tsx", wide: "", opts: { persona: NOTICE("Priya"), sound: true },
  body: () => `${track({ three: 2 })}<div class="rc"><h1 class="h1">See the receipts</h1>
<section><h2 class="h2">Her questions</h2>${[0, 1].map((i) => qa({ q: PQ[i], rem: PR[i], remLabel: "She remembered · fictional", wrote: PA[i], wroteLabel: "She wrote, as of 12 May 2024", pers: true })).join("")}</section>
<section><h2 class="h2">What she wrote, as of 12 May 2024</h2>${letterPaper(priya, "Written as of 12 May 2024")}</section>
${sealRow({ hash: hashes.priya, tamper: tamperBtn })}${endPersona(true)}</div>` });

// ---------------------------------------------------------------- Keepsakes
const keepNote = `<p class="muted small center" style="margin-top:20px">Printable keepsake, shown at screen size.</p>`;
add({ id: "letter-card", title: "Letter card", route: "downloaded at sealing", state: "The printable letter card. Contains no key.", fixes: [3], component: "src/lib/cards/letter-card-svg.ts", wide: "mid", opts: {},
  body: () => `<div class="center stack" style="margin-bottom:24px"><h1 class="h1">Letter card</h1></div>
<div class="card"><div class="qr">${qr}</div><div><span class="word2">revenant</span><h2>Your letter is sealed</h2>
<span class="k">Opens</span><b>${LIVE.opens}</b><span class="k">Your letter link</span><span class="mono">${LIVE.link}</span>
<span class="k">Fingerprint at sealing</span><span class="mono" style="font-size:12px">${groups(LIVE.hash).map((g) => `<span class="g4">${g}</span>`).join(" ")}</span>
<p style="margin-top:12px;font-size:17px">Scan the code to open the letter. Before the opening time it shows only that the letter is still sealed. This card holds no key.</p></div></div>${keepNote}
<div class="row c" style="margin-top:12px">${btn("Save the card as an image", "#", "small")}${btn("Print or save as PDF", "#", "two small")}</div>` });
add({ id: "backup-card", title: "Backup key card", route: "downloaded at sealing", state: "The printable backup key card. The only place the key exists.", fixes: [3], component: "src/components/live/BackupKeyCard.tsx", wide: "mid", opts: {},
  body: () => `<div class="center stack" style="margin-bottom:24px"><h1 class="h1">Backup key card</h1></div>
<div class="card"><div class="qr">${qr}</div><div><span class="word2">revenant</span><h2>Backup key card</h2>
<p style="margin-top:8px;font-size:18px">This card opens your letter on its own after the opening date. Keep it somewhere safe, like a house key.</p>
<span class="k">Your backup key</span><div class="keybox">KM7Q-X2PD-9RTA-W4HC-J8VN-3EYL</div>
<span class="k">Opens</span><b>${LIVE.opens}</b><span class="k">Your letter link</span><span class="mono">${LIVE.link}</span>
<p style="margin-top:12px;font-size:16px">Scan this code to open the letter link with your backup key.</p></div></div>
<p class="muted small center" style="margin-top:20px">Sample key, for this prototype only. Printable keepsake, shown at screen size.</p>
<div class="row c" style="margin-top:12px">${btn("Save the card as an image", "#", "small")}${btn("Print or save as PDF", "#", "two small")}</div>` });
