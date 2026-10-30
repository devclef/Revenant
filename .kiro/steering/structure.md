---
inclusion: always
---

# Structure

Planned layout. Update this file when the structure changes.

```
.
├── .kiro/
│   └── steering/            # These docs
├── .github/
│   └── workflows/build.yml  # CI: checks, image build and push to ghcr.io/devclef/revenant
├── deploy/
│   └── helm/revenant/       # Helm chart with Postgres (see deploy.md); kept in sync with the app. No Fleet config here.
├── Dockerfile               # One image for web, migrations and the fetch job
├── content/
│   └── personas/            # Demo persona letters (text only, reviewed against neutrality.md)
├── drizzle/                 # SQL migrations, including immutability triggers
├── scripts/                 # fetch-figures (run by the CronJob), prefetch demo-window data, seal-personas
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── page.tsx         # Landing
│   │   ├── seal/            # Write letter, choose figures, opening date, lock, cards
│   │   ├── l/[id]/          # Letter link from the QR card: countdown, unlock, recall, reveal
│   │   ├── demo/
│   │   │   ├── personas/    # Demo 1: pre-sealed persona letters
│   │   │   └── live/        # Demo 2: seal with your own passkey, 30-second lock
│   │   └── api/
│   │       ├── letters/     # Prepare, seal, status, release serverSecret after opens_at
│   │       ├── openings/    # Append encrypted recall answers
│   │       ├── figures/     # Latest figures for the whole catalogue
│   │       └── health/      # Liveness/readiness probe; touches no letter data
│   ├── components/
│   │   ├── seal/            # Sealing ceremony UI
│   │   ├── reveal/          # Unsealing sequence, then vs now views
│   │   └── ui/              # Shared primitives (buttons, parchment surfaces, typography)
│   └── lib/
│       ├── crypto/          # Browser-only: WebAuthn PRF, HKDF, AES-GCM, backup key, envelope hash
│       ├── seal-format/     # Versioned sealed payload schema (one module per format_version)
│       ├── cards/           # Browser-only: letter card (QR link) and backup key card (PDF)
│       ├── ics/             # Browser-only: calendar file for the opening date
│       ├── figures/         # Provenance types, comparability checks, then-vs-now change
│       ├── sources/         # One adapter per publisher: eia, bls, oil-bulletin, eurostat, scb
│       ├── recall/          # Writes recall questions at sealing time; they are then sealed
│       ├── events/          # Election dates with provenance for the demo windows
│       └── db/              # Drizzle schema and client
└── .env.example
```

## Rules

- `.kiro/` (steering, specs, hooks) is committed to the repository and must never be added to `.gitignore`. The hackathon requires it.
- `lib/crypto`, `lib/cards` and `lib/ics` are browser-only. Server code must not import them.
- `lib/sources` adapters are the only code that talks to external data publishers. Everything else reads figures from the database.
- `lib/figures` is the only place that computes derived values like the then-vs-now change, so the formula shown to users and the formula used are the same code.
- Demo letters (personas and live) and real sealed letters live in separate tables (see `data-integrity.md`).
- User-facing copy follows `tone.md` and `neutrality.md`. Keep strings for the seal, recall and reveal flows together in their feature folders so they're easy to review.
- `crypto.md` loads automatically for `lib/crypto`, `lib/seal-format`, `api/letters`, `api/openings` and the persona sealing script. Keep crypto-related code inside those paths so the rules load when needed.
