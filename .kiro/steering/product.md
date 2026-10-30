---
inclusion: always
---

# Product: Revenant

**Tagline:** "Your past self returns with the receipts."

Built for the Kiroween hackathon, Resurrection category. The technology being resurrected is the sealed letter to your future self: the classroom time capsule a teacher mails back years later.

## The problem

People remember the past through rose-tinted glasses, and they rarely trust anyone else to correct them. The one source most people will believe is themselves.

## Core loop

1. **Write.** The user writes a letter to their future self.
2. **Choose figures.** The user picks data that matters to them:
   - Public figures from official sources (fuel, groceries, rent, etc.) for a chosen region.
   - Personal numbers only they know (their own rent, commute cost). These are labelled as self-reported.
3. **Choose an opening.** A calendar date at least 3 months away.
4. **Seal.** Everything needed to open the letter goes inside it: the letter, the figures with their sources and the recall questions. The letter does not rely on any data source or app feature still existing when it opens. The user locks it with a passkey (fingerprint, face or device PIN) and can also download a backup key card.
5. **Keep.** The user gets a letter card with a QR code and an `.ics` calendar file for the opening date.
6. **Wait.** Sealed contents are immutable and hidden, including from the author. Scanning the QR code before the opening date shows only that the letter is still sealed and a countdown.
7. **Recall first.** After the opening date, the user scans the QR code and unlocks with their passkey or backup key. Revenant asks the sealed recall questions *before* showing anything. Their answers are recorded.
8. **Reveal.** Revenant shows, in order:
   - What they remembered (just now).
   - What they actually wrote (then).
   - The numbers then vs now, with the plain change between them.

The gap between memory and record is the product. Revenant does not interpret that gap for the user.

## Non-negotiables

- **Data integrity.** See `data-integrity.md`. Every number has a source, period, unit and region. Nothing is invented or estimated. Sealed data never changes.
- **Neutrality.** See `neutrality.md`. Revenant never takes a political side. It only shows people their own words and real data.
- **Tone.** See `tone.md`. A ghost of your past self: wax seals, faded ink. Spooky but respectful, never cheesy.
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
- **Recall step (MVP):** fixed questions generated from the data points the user tracked ("What do you think a gallon of gas cost then?"). AI-generated questions based on the letter text are a post-MVP idea and must still follow `neutrality.md`.
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

Pre-sealed letters from fictional people, written before a recent election in their region and set to open on that election day. Judges get the opening experience without a passkey: break the seal, recall, reveal.

- One or two personas per region, chosen from these fixed windows (the 12 months up to and including election day):
  - **US:** presidential election, 5 November 2024.
  - **EU:** European Parliament election, 6–9 June 2024.
  - **Sweden:** Riksdag election, 11 September 2022 (the one before the 2026 election, which is too recent to show a meaningful gap).
- Figures are official everyday metrics (for example fuel and groceries), as real historical records for the persona's date, with full provenance. Personas have no personal numbers.
- No passkey. Each persona letter is sealed with a published demo key, and "Break the seal" opens it.
- The persona letter is shown as a demo, written "as of" its window date. It never claims to have been sealed at that date.
- The personas themselves are chosen after the MVP is up.

### Demo 2: Lock and unlock

This demo shows the unlock capability. The judge writes a short letter, picks figures, and seals it for real with their own passkey (and optionally a backup key). Revenant generates a new letter card (QR) and `.ics` file for it. The time lock is 30 seconds instead of years. When the countdown ends, they scan the QR code and unlock with the same passkey.

- The 30-second lock exists only for demo letters. The server rejects short locks for real letters.
- The judge's passkey is real and will appear in their passkey manager, named so it is obviously a Revenant demo.
- After 30 seconds the "now" figures will match "then". That is expected; the then-vs-now story belongs to Demo 1.
- Details of this flow are refined after the MVP is up.

## Build order

1. **Starter data sources (first spec task).** Pick a small set of official series per region (for example fuel and a few grocery items) that are reachable, publish real prices or a clearly labelled index, and cover the demo windows. Enough to build on, not an exhaustive survey.
2. Feature work follows from the spec.

## Open product questions

- Final production domain (subdomain of devclef.se or a new domain). MVP uses `revenant.devclef.se`.
- Which personas and figures to use in Demo 1.
- Delivery method for opened letters (email, physical mail, other).
- Full metric list per region and final recall question wording (after the MVP works).
- Whether to bring back wages and hours of work.
- Maximum sealing period for real letters.
- Database backups (not in the chart for now).
