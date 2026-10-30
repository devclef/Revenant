---
inclusion: always
---

# Tech

The goal is a working, demonstrable product for a hackathon, not scale. Prefer the simplest option that keeps the non-negotiables in `data-integrity.md` and `neutrality.md` intact.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict mode) everywhere | One language for frontend, backend and scripts. |
| App | Next.js, App Router, `output: "standalone"` | Server components and route handlers for the backend. No separate API server. |
| Database | PostgreSQL, deployed by the Helm chart | Database triggers enforce immutability of sealed data. |
| ORM | Drizzle, with SQL migrations | Triggers and constraints are written as raw SQL in migrations. |
| Scheduled jobs | Kubernetes CronJob running a script from the app image | Daily data fetch only. No HTTP endpoint for it. |
| Encryption | WebCrypto, in the browser only | Details in `crypto.md`. |
| Unlocking | WebAuthn passkeys with the PRF extension, via the browser API directly | No server-side WebAuthn library; the server never verifies assertions. |
| Cards and calendar | QR codes, PDF cards and `.ics` generated in the browser | Backup key material must never reach the server. |
| Container | One Docker image for the app, migrations and the fetch job, at `ghcr.io/devclef/revenant` | Built and pushed by GitHub Actions. |
| Deployment | Helm chart in this repo. The user deploys it with Fleet from a separate GitOps repo to their RKE2 cluster (Rancher on Harvester). | Details in `deploy.md`. |
| Domain | `revenant.devclef.se` for MVP and testing | Passkeys are bound to the domain (RP ID) and need HTTPS. |
| Package manager | npm | |

Not in the MVP: user accounts and login, email or any other delivery channel, LLM features, rate limiting and spam protection, public events as opening triggers, languages other than English.

## Sealing and unlocking (summary)

Full rules, key hierarchy and threat model are in `crypto.md`, which loads when working on crypto code. These invariants apply everywhere:

- The browser encrypts. The server only ever stores ciphertext, the unencrypted header, and the per-letter time-lock `serverSecret`.
- A letter has a random content key that is wrapped twice: once with a key from the user's passkey (WebAuthn PRF), and once with a backup key. Both wraps also require the `serverSecret`.
- The server releases the `serverSecret` only when its UTC clock is at or after `opens_at`. The client clock never decides.
- PRF support must be checked at sealing on the user's actual device. If it passes, the backup key is optional. If it fails, the backup key is required.
- The backup key, PRF output and content key never leave the browser and are never logged.
- Recall answers are encrypted too, so the operator can't read them.

### PRF support

Support depends on the browser, operating system and passkey provider together. As of 2026, it works with iCloud Keychain on macOS and iOS 18+, Google Password Manager on Android, and Windows Hello only on Windows 11 24H2/25H2 with the February 2026 update and Chrome/Edge 147+ or Firefox 148+. Some third-party passkey managers don't support it. Never assume support from the user agent; always run the check in `crypto.md`.

## The letter is self-contained

A sealed letter carries everything needed to open and present it. It must not depend on the app's current metric catalogue, question wording, source adapters, or on any data source still existing. If a source disappears or the app changes, the letter still opens and shows exactly what was sealed.

The encrypted payload contains:

- The letter text (plain text only, at most 5,000 characters).
- Every tracked figure with full provenance (value, unit, region, period, source, series ID, `source_url`, `retrieved_at`), both official and self-reported.
- Metric definitions as they were at sealing: display name, unit, region, source and series ID, so "now" data can be looked up later without the app's catalogue.
- The recall questions, written out in full at sealing time.
- Inputs and formula identifiers for any derived value (none in the MVP beyond the then-vs-now change, which is computed at opening).
- A `format_version` for the payload schema.

The unencrypted header holds only what's needed to find, time-lock and unlock the letter (see `crypto.md`). Nothing in it reveals what the letter tracks.

Opening code must support every `format_version` ever sealed. Never change the meaning of an existing version; add a new one instead.

## Opening

1. Letter link loads. Before `opens_at`: "still sealed" and a countdown, nothing else.
2. After `opens_at`: unlock with passkey or backup key, verify, decrypt in the browser.
3. Show the sealed recall questions. Store the encrypted answers before anything else is displayed.
4. Reveal the letter and sealed figures.
5. For "now" figures, the browser downloads the latest figures for the whole catalogue and picks the series it needs locally, so the server never learns what a letter tracks. If a series is no longer available, the reveal says so and still shows the sealed figure.
6. Derived values (the then-vs-now change) are calculated in the browser.

## Cards and calendar file

All generated in the browser at sealing, after the seal is stored.

- **Letter card:** printable PDF and image with a QR code of `https://<domain>/l/<letterId>`, the opening date, and nothing secret.
- **Backup key card:** separate PDF download with the letter link and the backup key, in text and as a QR code with the key in the URL fragment (see `crypto.md`). Never uploaded or cached by the server or a service worker.
- **`.ics` file:** one event at `opens_at` (stored and written in UTC), titled in Revenant's voice, with the letter link in the description and `URL` field, and a reminder alarm. It contains no letter content, no figures and no key.

### Known limitation (accepted for MVP)

Opening depends on Revenant's server releasing the server secret. If the service or its database is gone, sealed letters cannot be opened. Post-MVP options: let users download their encrypted envelope, and publish server secrets after `opens_at` so envelopes can be opened without Revenant.

## Integrity enforcement

- Sealed tables have a `BEFORE UPDATE OR DELETE` trigger that raises an exception. Application code cannot change a sealed row.
- Anything that happens after sealing (encrypted recall answers, opening timestamps) goes in separate append-only tables that reference the sealed letter.
- The sealed envelope (header and ciphertext) is serialised as canonical JSON (RFC 8785) and hashed with SHA-256. The hash is computed in the browser, recomputed and checked by the server at sealing, stored alongside the envelope, and verified again at opening. The AES-GCM authentication tag separately proves the decrypted payload is unaltered.
- All timestamps are stored in UTC (`timestamptz`).
- The server enforces the allowed range for `opens_at`: at least 3 months after sealing for real letters. The 30-second lock is accepted only for live demo letters, which live in their own table.

## Data sources

Each publisher gets one adapter that returns figures with full provenance (see `data-integrity.md`). Adapters never fill gaps or convert currencies.

The daily fetch job fetches every series in the current catalogue. Removing a series from the catalogue never affects sealed letters; their "now" figure is simply shown as unavailable.

Regions and currencies: **US** in USD, **EU** in EUR (EU-wide averages, wherever a source publishes one), **Sweden** in SEK.

Starter candidates, to be confirmed by the first spec task and tuned after the MVP works:

| Region | Fuel | Groceries | Rent |
|---|---|---|---|
| US | EIA | BLS average prices | BLS (may be index only) |
| EU | European Commission Weekly Oil Bulletin (EU average) | Eurostat (likely index only) | Eurostat (likely index only) |
| Sweden | European Commission Weekly Oil Bulletin | SCB (verify actual prices vs index) | SCB |

Where only an index exists, show it as an index with percentage change. Never convert an index into a price.

## Secrets and configuration

- All secrets come from environment variables: `DATABASE_URL`, and any source API keys (for example `BLS_API_KEY`, `EIA_API_KEY`). Never commit them, and never log them. In Kubernetes they come from a Secret (see `deploy.md`).
- `RP_ID` and `APP_ORIGIN` are fixed configuration: `revenant.devclef.se` and `https://revenant.devclef.se` for the MVP, `localhost` for local development outside the cluster.
- Keep a `.env.example` listing every variable name with no values.

## Conventions

- Validate all request bodies at route handlers with Zod.
- Use parameterised queries only (Drizzle does this by default; raw SQL must use placeholders).
- Store numbers at full published precision as `numeric`, never as floating point. Round only for display.
- `lib/crypto` is browser-only and must never be imported by server code.
- Strict Content Security Policy. No third-party scripts or analytics on any page that seals or opens letters.
- Keep dependencies few and pinned through the lockfile, since injected JavaScript is the main risk to letter privacy.
- UI is English only. Dates and numbers are formatted for the figure's region.

## Keep the Helm chart in sync

The chart in `deploy/helm/revenant` is part of the product, not an afterthought. Any change that adds or renames an environment variable, secret, port, health endpoint, migration step or scheduled job must update the chart, its `values.yaml`, and `.env.example` in the same change, and bump the chart `version`. See `deploy.md`.
