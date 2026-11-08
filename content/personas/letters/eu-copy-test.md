# EU persona copy test: eu-tomas

Status: copy test record. The EU persona must not be sealed until a named reviewer records a pass.

## Full text of content/personas/letters/eu-tomas.txt

```text
Dear future me,

It is a warm Sunday evening in May, and the balcony is usable again. The swifts are back over the rooftops. I wanted to write this down before the summer gets busy.

Work at the hospital pharmacy is steady. The shifts rotate every few weeks, which is tiring, but I have got used to the early starts and the tram that is always half empty at that hour. Filling the car at the petrol station on the ring road has become a monthly habit. I now check the price before I pull in, and I have started keeping the receipts in a folder, though I never look at them.

On Saturdays I go to the covered market with Inês. We split the list: she takes the fish and the bread, I take the vegetables and the cheese. We always end up buying too much fruit. She is saving for a trip to see her brother in Gdańsk and talks about it constantly.

Dad's new flat is small but bright. He jokes about the rent, and then he goes quiet for a moment. I hope that by the time you read this, it has become easier for him.

I am planning to finish the bookbinding course in the autumn. The materials need a separate budget, but the class is on Thursdays, which fits. I would like to make a notebook for you, something with a proper spine.

I don't know what you will remember of this spring. I think you will remember the swifts, and the smell of the market on Saturday morning.

Love,
Tomás
```

## Persona labels

- Display name: Tomás
- Region: European Union
- Written as of: 2024-05-12
- Opens: 2024-06-09T00:00:00.000Z (European Parliament election, 2024-06-09)
- Recall subjects:
  - a litre of unleaded petrol (metric_id `eu-petrol-euro95`)
  - a litre of diesel (metric_id `eu-diesel`)

## Figure pick check (then figures at written_as_of)

The then figure is the latest `fuel-figures.json` row with a period end on or before 2024-05-12, under the same rule as `thenAndNow` in `src/lib/figures/then-now.ts`. Both series are weekly, so the 2024-05-06 row is the pick for each.

- `eu-petrol-euro95`: period 2024-05-06, value 1791.3149889844324, unit EUR per 1,000 litres, region EU27 weighted average, series column `EU_price_with_tax_euro95`.
- `eu-diesel`: period 2024-05-06, value 1645.194212158339, unit EUR per 1,000 litres, region EU27 weighted average, series column `EU_price_with_tax_diesel`.

`src/lib/personas/eu-entry.test.ts` checks this pick field for field against the JSON row.

## Copy test record (neutrality.md)

Reviewer: pending: no named human reviewer yet
Result: pending: no named human reviewer yet

The EU persona must not be sealed until a named reviewer records a pass. The copy test asks whether each sentence reads the same to someone who holds the opposite political view. No reviewer has done that yet, so no pass is recorded here. An agent may not fill in the reviewer or the result.

### Reviewer checklist (neutrality.md)

The reviewer reads `content/personas/letters/eu-tomas.txt` and answers each question for every sentence:

1. Would this sentence read the same to someone who holds the opposite political view?
2. Does the letter name, praise or criticise any party, candidate, official or movement? (Expected: no.)
3. Does the letter say who the persona will vote for, or whether they will vote? (Expected: no.)
4. Does the letter explain or attribute a price or cost change to a cause, policy or government? (Expected: no.)
5. Does the letter describe any cost as good or bad, or as rising or falling in a loaded way? (Expected: no.)
6. Does the letter avoid stereotypes tied to region, class, age, nationality or background? (Expected: yes.)
7. Is the letter about everyday life only: work, family, bills, plans and hopes? (Expected: yes.)
8. Does any fixed figure in the letter come from the sealed figures file, and does the letter avoid stating any figure not in that file? (Expected: yes.)

Any answer that differs from the expected one blocks the pass. The reviewer then records the issue here and the copy is rewritten before a new review.

### Earlier tests this change touches

- `src/lib/personas/index.test.ts`: the Persona_List key guard. It expects the persona keys to be exactly `eu-tomas` and `us-maya`, with no duplicates. Adding the EU entry changes that expected list, so the guard covers the EU persona.
- `src/lib/personas/eu-entry.test.ts`: checks the EU entry's `opens_at` (`2024-06-09T00:00:00.000Z`), its `opening_event` fields and its letter file.
- `src/lib/personas/opening-event.test.ts`: the schema rules for `opening_event` (https `source_url`, no extra fields).

### opening_event values (content/personas/personas.json)

Persona `eu-tomas`:

- `name`: European Parliament election
- `date`: 2024-06-09
- `source`: European Parliament
- `source_url`: https://www.europarl.europa.eu/elections/en/

The opening date is a plain public calendar date. It does not follow the event if the event moves.

## Removal of the opening event (spec 10 X4, issue #300)

- Removed: `opening_event` of `eu-tomas`, "European Parliament election", 2024-06-09, from `content/personas/personas.json`. The schema no longer accepts `opening_event`, and the persona UI shows only "Opens {date}" with no event name and no source link.
- Opening date kept: 2024-06-09T00:00:00.000Z, shown as a plain date.
- Reviewer: Jacob Morgan (named in issue #300).
- Result: pending: Jacob Morgan has not yet recorded a pass or fail for the persona copy after this removal.
- Retired phrase: "European Parliament election" is in `RETIRED_PHRASES` in `src/test/retired-phrases.test.ts`. This record quotes it and is excluded from that scan.
