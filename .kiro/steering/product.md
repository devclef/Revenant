---
inclusion: always
---

# Product: Revenant

**Tagline:** "The wax seal, resurrected. Memory rewrites itself. Revenant doesn't."

Revenant seals what you believe now, in any part of life: goals for the year, a worry at work, family, a decision. Prices are one example of a receipt, never a requirement.

Built for the Kiroween hackathon, Resurrection category. The technology being resurrected is the wax seal: the plis cachetés the French Académie des sciences has kept since 1735, sealed envelopes that prove what someone knew, and when. A classroom time capsule, a letter to your future self that a teacher mails back years later, works the same way.

## The problem

Memory rewrites itself. Every time you recall something, you edit it a little, and you can't cross-examine your own past: the only witness is a memory that has already been rewritten.

## What's new

The one thing no wax seal could do: Revenant makes you testify before you read. The gap between your testimony and the record is the product, and Revenant never says what it means. A letter may hold any part of life. Official figures are one kind of receipt, and a letter does not need them.

## Core loop

1. **Write.** The user writes a letter to their future self. They may start from an Occasion (the year ahead, work, family, a decision, or blank), which offers a letter starter and up to three questions the author can edit or remove. Questions are written to be read on the opening day and name the sealing day.
2. **Add a receipt (optional).** The user may add data that matters to them. A letter needs at least one question or one official figure:
   - Public figures from official sources (fuel, groceries, rent, etc.) for a chosen region.
   - Personal numbers only they know (their own rent, commute cost). These are labelled as self-reported.
3. **Press the seal.** Choose an opening date at least 3 months away and lock the letter with a passkey. Everything needed to open the letter goes inside it: the letter, the figures with their sources and the recall questions. The letter does not rely on any data source or app feature still existing when it opens. The user locks it with a passkey (fingerprint, face or device PIN) and can also download a backup key card.
4. **Keep.** The user gets a letter card with a QR code and an `.ics` calendar file for the opening date.
5. **Wait.** Sealed contents are immutable and hidden, including from the author. Scanning the QR code before the opening date shows only that the letter is still sealed and a countdown.
6. **Testify.** After the opening date, the user scans the QR code and unlocks with their passkey or backup key. Revenant asks the sealed questions *before* showing anything: first the questions the user wrote, then the questions about the figures. Their answers are recorded.
7. **See the receipts.** Revenant shows, in order:
   - Each of their own questions with the answer they just gave, and their testimony on the figures (just now).
   - What they actually wrote (then), in full.
   - The numbers then vs now, with the plain change between them. This appears only when the letter holds figures. A letter with no figures ends on the testimony and the letter.

The gap between memory and record is the product. Revenant does not interpret that gap for the user.

## Non-negotiables

- **Data integrity.** See `data-integrity.md`. Every number has a source, period, unit and region. Nothing is invented or estimated. Sealed data never changes.
- **Neutrality.** See `neutrality.md`. Revenant never takes a political side. It only shows people their own words and real data.
- **Tone.** See `tone.md`. A ghost of your past self rising out of the dark with your letter: purple light, one orange seal. Spooky but respectful, never cheesy.
- **Privacy.** The operator cannot read letters, personal numbers or recall answers. See `tech.md` and `crypto.md`.

## Out of scope (unless decided otherwise)

- Commentary, analysis or explanation of why numbers changed.
- Social feeds, public letters, or comparing users against each other.
- Editing a letter after it is sealed.
- User accounts. A passkey locks one letter; it is not a login.

## Decisions

- **Regions:** United States, European Union, and Sweden.
- **No predictions in the MVP.** Users can't make scored predictions yet. The rules in `neutrality.md` apply if they are added later.
- **No wages in the MVP.** No wage statistics and no "hours of work". The reveal shows figures then vs now and the change between them. Hours of work may come back after the MVP.
- **Data sources and recall questions are tuned after the MVP works.** Start with a small set of series that are easy to fetch and cover the demo windows, then refine.
- **Opening date is fixed at sealing.** It opens at 00:00 in the user's timezone at sealing, stored as a UTC `opens_at`. Real letters must open at least 3 months after sealing.
- **No public events as openings in the MVP.** Later, upcoming elections may be suggested as dates. A suggestion only fills in a plain date; the letter never follows an event if it moves.
- **Regions and currencies:** US in USD, EU in EUR (EU-wide averages wherever an official source publishes one), Sweden in SEK. No currency conversion.
- **Language:** English only.
- **Letter content:** plain text only, at most 5,000 characters.
- **Hosting (MVP):** the user's self-hosted RKE2 cluster, internet-facing with Let's Encrypt HTTPS, deployed by the user's own Fleet GitOps repo. This repo provides the Helm chart (with Postgres included) and the image on GHCR (see `deploy.md`). Spam protection and rate limiting are handled later.
- **Testify step (MVP):** the questions the author wrote for their future self (up to three, sealed as written, each written to be read on the opening day and naming the sealing day), then fixed questions generated from the figures the user tracked, if any ("What do you think a gallon of gas cost then?"). AI-generated questions based on the letter text are a post-MVP idea and must still follow `neutrality.md`.
- **Unlocking:** a passkey using the WebAuthn PRF extension, unlocked with fingerprint, face or device PIN. A backup key card is offered as a second way in and is optional when the passkey works. Skipping it needs an explicit confirmation that a lost passkey means a lost letter. If the user's passkey can't produce a PRF key at sealing, the backup key becomes required.
- **Opening on another device:** passkeys may not move between ecosystems (for example from iCloud to an Android phone). The sealing screen explains this in plain words: open on a device that has the passkey, use a computer's "use a phone" option, or use the backup key.
- **Server time lock:** unchanged. Neither the passkey nor the backup key can open a letter before its opening date.
- **Letter card:** a QR code that is just a link with the letter's random ID. It contains no key. Before the opening date it shows "still sealed" and a countdown. After, it leads to unlock, recall and reveal.
- **Backup key card:** a separate download. It is the only place the backup key exists. It also carries the letter link, so after the opening date the card alone opens the letter. The card says to keep it like a house key.
- **Calendar file:** an `.ics` file with the opening date and the same link, generated at sealing.
- **Domain:** the MVP and testing run on `revenant.devclef.se`. Passkeys are bound to that domain. If production moves to a different domain later, letters sealed on `revenant.devclef.se` can only be opened there or with their backup key. Treat letters sealed before the final domain is chosen as test letters.
- **Dependence on Revenant (MVP):** opening a letter requires the Revenant server, which holds the time-lock secret. Accepted for the MVP; see `tech.md`.
- **Delivery:** no email or post in the MVP. The letter card and calendar file are how the user finds the letter again.

## Demo mode (for judges)

Judges can't wait years, so there are two demos. Both live at `/demo`, are clearly labelled, and are stored separately from real letters.

### Demo 1: Persona letters

Pre-sealed letters from fictional people, each written as of a date in its window and set to open on a fixed date. Judges get the opening experience without a passkey: open the letter, testify, break the seal, see the receipts. The persona page opens straight on the first question.

- One or two personas per region, chosen from these fixed windows (the 12 months up to and including the date):
  - **US:** up to 5 November 2024.
  - **EU:** up to 9 June 2024.
  - **Sweden:** up to 11 September 2022 (the window before the most recent one, which is too recent to show a meaningful gap).
- The fuel personas ask only the figure questions. Each question comes with a sample answer, labelled as a sample, that the judge can keep or change. For the fuel personas the testimony is the judge's own memory of that month.
- One persona is the exception. Her letter carries her own questions and no figures. Her answers to them are pre-written content, labelled as fictional on every screen that shows them. The judge reads her answers, breaks the seal and reads her letter. No answer of the judge's is recorded for this persona.
- The fuel personas and the live demo make the judge testify. The text persona shows what a testimony beside a letter looks like, in someone else's words.
- Opening dates are shown as plain dates, with no event name.
- Figures are official everyday metrics (for example fuel and groceries), as real historical records for the persona's date, with full provenance. Personas have no personal numbers.
- No passkey. Each persona letter is sealed with a published demo key, the demo key opens it in the browser, and the seal break in the reveal shows it.
- The persona letter is shown as a demo, written "as of" its window date. It never claims to have been sealed at that date.
- The personas themselves are chosen after the MVP is up.

### Demo 2: Lock and unlock

This demo shows the unlock capability. The judge writes a short letter, optionally adds figures, and seals it for real with their own passkey (and optionally a backup key). Revenant generates a new letter card (QR) and `.ics` file for it. The time lock is 30 seconds instead of years. When the countdown ends, they scan the QR code and unlock with the same passkey.

- The 30-second lock exists only for demo letters. The server rejects short locks for real letters.
- The judge can ask their own question. The Write step offers Occasions, and every Occasion starts with a default question anchored to the sealing day, which they can change or remove. The demo is a rehearsal of a letter that would normally stay sealed for months, and says so. Figures are optional. The payoff leads with the questions and the answers the judge gives 30 seconds later; any figures come after.
- The judge's passkey is real and will appear in their passkey manager, named so it is obviously a Revenant demo.
- After 30 seconds the "now" figures will match "then". That is expected; the then-vs-now story belongs to Demo 1.
- Details of this flow are refined after the MVP is up.

## Build order

The hackathon demo comes first, not the full product.

1. **01 Skeleton.** Deployable site, health checks, image, Helm chart. Done.
2. **02 Sealed letters.** Sealed letter format, browser crypto with a known demo key (no passkey or PRF), the first migration (letters, demo letters, openings, immutability triggers), and the API routes to get a letter, release its server secret after the opening date, and store encrypted recall answers.
3. **02 Demo figures (data-dev, alongside 02).** Two or three official series per region that cover the demo windows and today, delivered as a JSON file with full provenance. No fetch job.
4. **03 Persona demo** at `/demo`: pick a persona, answer the recall questions, break the seal, then see the answers, the letter, and the figures then vs now.
5. **Live passkey demo**, if time allows.
6. Remaining product work (passkey sealing for real letters, backup key card, PDF cards, `.ics`, the daily fetch job) after the demo.

## Open product questions

- Final production domain (subdomain of devclef.se or a new domain). MVP uses `revenant.devclef.se`.
- Whether real sealing (`/seal`) is switched on for judging, with a visible test-letter notice. Go or no-go on 20 November 2026; with no decision it stays off.
- Which personas and figures to use in Demo 1.
- Delivery method for opened letters (email, physical mail, other).
- Full metric list per region and final recall question wording (after the MVP works).
- Whether to bring back wages and hours of work.
- Maximum sealing period for real letters.
- Database backups (not in the chart for now).
