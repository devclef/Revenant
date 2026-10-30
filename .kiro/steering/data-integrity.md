---
inclusion: always
---

# Data Integrity

Revenant's credibility rests entirely on its numbers. A single invented or altered figure breaks the product. These rules override convenience, deadlines and UI polish.

## Every figure carries provenance

No number is stored or displayed without all of:

| Field | Meaning | Example |
|---|---|---|
| `value` | The number exactly as published | `3.412` |
| `unit` | Unit and currency | `USD per gallon` |
| `region` | Geographic scope as the source defines it | `U.S. city average` |
| `period` | The period the figure describes | `2026-09` |
| `source` | Publisher and series identifier | `U.S. EIA, series EMM_EPMR_PTE_NUS_DPG` |
| `retrieved_at` | When Revenant fetched it (UTC) | `2026-10-30T14:02:11Z` |
| `source_url` | Link a user can follow to check it | |

Self-reported personal numbers use `source = self-reported` and are always labelled as such in the UI. They are never mixed into or presented as official data.

## Every displayed figure shows its period

- Wherever a number appears (reveal, sealing screen, demo, cards, exports), its period is shown next to it in plain form, for example "$3.41 per gallon · Sep 2026 · U.S. city average". The source is one tap or click away.
- Show the figure's own period, not the date the letter was sealed or opened. A letter sealed in October may hold a September figure, and the UI must make that visible.
- Derived values show the period of every input, for example "+12% · Sep 2024 to Sep 2026".

## Never invent, estimate or fill gaps

- Do not interpolate, extrapolate, average across gaps, or substitute a "close enough" series or region.
- Never convert currencies. An exact unit rescale (for example a source's "per 1,000 litres" shown as "per litre") is allowed only at display time, is shown to the user, and the stored value stays as published.
- Do not hardcode figures, use placeholder numbers, or generate numbers with an LLM. Seed and test data must be clearly fake and must never reach production or a demo presented as real.
- If a figure is unavailable (source down, series discontinued, period not yet published), show that it is unavailable and why. An honest gap is acceptable. A guessed number is not.
- If the "then" and "now" figures differ in unit, region, methodology or series, do not compare them. Say they are not comparable.

## Derived values are calculations, not estimates

Derived values (in the MVP, only the change between then and now) are allowed only when:

- Every input is a sourced figure (or a labelled self-reported one) from the same series, unit and region. If they aren't comparable, the derived value is not shown; the raw figures are shown with their own periods instead.
- The formula is shown to the user alongside the result, with links to each input.
- Rounding happens only at display time. Stored values keep full published precision.

## Sealed data is immutable

- Sealed figures are stored inside the sealed letter itself, with full provenance. They are never re-fetched, looked up from a shared table, or reconstructed at opening. A sealed letter must still show its figures if the source, the series or Revenant's catalogue no longer exists.
- Once sealed, the letter, snapshot figures, recall questions and opening condition cannot be updated or deleted by application code. Enforce this at the database level, not just in app logic.
- Store a cryptographic hash (SHA-256) of the canonical sealed envelope at sealing time, and verify it when the letter opens (see `crypto.md`). Show the user that verification passed. If it fails, say so and do not present the data as trustworthy.
- If a source later revises a historical figure, the sealed value stays as it was. The reveal may show the revision separately and clearly labelled, never as a replacement.
- Record times in UTC. Store the user's timezone separately for display.

## Demo mode

- Demo letters are stored separately from real sealed letters and can never be mistaken for or converted into one.
- **Persona letters:** the people are fictional, but every official figure is a real historical record for the persona's date, with full provenance. Label them "historical record, retrieved [date]", never "sealed on [persona date]". The persona letter says it was written "as of" its date and prepared later as a demo.
- **Persona personal numbers:** personas have none. Persona letters contain only official figures.
- **Live demo:** the judge's figures are genuinely sealed at that moment. After a 30-second lock, "now" figures will usually be the same as "then". Show that honestly; don't fabricate a change.

## Fetching "now" data

- Current figures are fetched from the same source and series that the sealed figure used.
- Store each fetch with full provenance so the reveal is reproducible.
- Prefer official statistical agencies and primary publishers. Do not scrape figures from news articles or aggregators when a primary source exists.

## Code review checklist

When writing or reviewing code that touches data, check:

- Does every number have value, unit, region, period, source and retrieved_at?
- Does every displayed number show its period?
- Can any code path modify or delete a sealed record?
- Can any code path produce a number that did not come from a source or the user?
- Are mismatched or missing figures shown honestly instead of hidden or filled?
