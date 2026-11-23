# EU persona copy test: eu-tomas

Status: copy test record. The EU persona must not be sealed until a named reviewer records a pass.

## Persona labels

- Display name: Tomás
- Region: European Union
- Written as of: 2024-11-17 (plain date, no event name)
- Opens: 2026-11-17T00:00:00.000Z (plain date, no event name)
- Recall subjects:
  - a litre of unleaded petrol (metric_id `eu-petrol-euro95`)
  - a litre of diesel (metric_id `eu-diesel`)

## Texts under review

1. The letter, `content/personas/letters/eu-tomas.txt`. Not repeated here, so the file has one source.
2. The `intro_line` of `eu-tomas` in `content/personas/personas.json`:
   "Tomás, who works shifts at a hospital pharmacy, writes on a November Sunday about his commute, the car and the market with Inês."

## Copy test record (neutrality.md)

Reviewer: Jacob Morgan
Result: pending

The EU persona must not be sealed until a named reviewer records a pass. The agent did not record a pass.

### Reviewer checklist (neutrality.md)

The reviewer reads each text above and answers each question for every sentence:

1. Would this sentence read the same to someone who holds the opposite political view?
2. Does the text name, praise or criticise any party, candidate, official or movement? (Expected: no.)
3. Does the text say who the persona will vote for, or whether they will vote? (Expected: no.)
4. Does the text explain or attribute a price or cost change to a cause, policy or government? (Expected: no.)
5. Does the text describe any cost as good or bad, or as rising or falling in a loaded way? (Expected: no.)
6. Does the text avoid stereotypes tied to region, class, age, nationality or background? (Expected: yes.)
7. Is the text about everyday life only: work, family, bills, plans and hopes? (Expected: yes.)
8. Does the text name an election, a vote, a public holiday or any other public event? (Expected: no.)

Any answer that differs from the expected one blocks the pass. The reviewer then records the issue here, and the copy is rewritten before a new review.

### Owner checks not run by the agent

- Real_Device_Check: not run by the agent.

## Agent self-check (does not count as a pass)

This is the agent's own reading of the checklist above. It is not a pass. Jacob Morgan's result is pending for every row.

Expected answers in order: **Y N N N N Y Y N**. Each row gives the agent's answers in the same order.

| # | Sentence | Agent | Same as expected |
|---|---|---|---|
| T1 | Dear future me, | Y N N N N Y Y N | yes |
| T2 | It is a cold Sunday evening in November, and the balcony door has stayed shut all week. | Y N N N N Y Y N | yes |
| T3 | It gets dark before five now, and the street smells of wood smoke. | Y N N N N Y Y N | yes |
| T4 | I wanted to write this down before the winter gets busy. | Y N N N N Y Y N | yes |
| T5 | Work at the hospital pharmacy is steady. | Y N N N N Y Y N | yes |
| T6 | The shifts rotate every few weeks, which is tiring, but I have got used to the early starts and the tram that is always half empty at that hour. | Y N N N N Y Y N | yes |
| T7 | Filling the car at the petrol station on the ring road has become a monthly habit. | Y N N N N Y Y N | yes |
| T8 | The news said the EU average for unleaded was about €1.63 a litre in the second week of November. | Y N N N N Y Y N | yes |
| T9 | Diesel was about €1.53 a litre, also in the second week of November. | Y N N N N Y Y N | yes |
| T10 | I now check the price before I pull in, and I have started keeping the receipts in a folder, though I never look at them. | Y N N N N Y Y N | yes |
| T11 | On Saturdays I go to the covered market with Inês. | Y N N N N Y Y N | yes |
| T12 | We split the list: she takes the fish and the bread, I take the vegetables and the cheese. | Y N N N N Y Y N | yes |
| T13 | The stalls have chestnuts and squash now, and we always come home with more fruit than we planned. | Y N N N N Y Y N | yes |
| T14 | She is saving for a trip to see her brother in Gdańsk and talks about it constantly. | Y N N N N Y Y N | yes |
| T15 | Dad's new flat is small but bright. | Y N N N N Y Y N | yes |
| T16 | He has found a café on the corner where they know his order. | Y N N N N Y Y N | yes |
| T17 | I hope that by the time you read this, he feels at home there. | Y N N N N Y Y N | yes |
| T18 | I am halfway through the bookbinding course. | Y N N N N Y Y N | yes |
| T19 | The materials need a separate budget, but the class is on Thursdays, which fits. | Y N N N N Y Y N | yes |
| T20 | I would like to make a notebook for you, something with a proper spine. | Y N N N N Y Y N | yes |
| T21 | I don't know what you will remember of this autumn. | Y N N N N Y Y N | yes |
| T22 | I think you will remember the wood smoke, and the smell of the market on Saturday morning. | Y N N N N Y Y N | yes |
| T23 | Love, Tomás | Y N N N N Y Y N | yes |
| I1 | Intro line of `eu-tomas` | Y N N N N Y Y N | yes |

**Points for the reviewer.**

- T8 and T9 quote the EU average prices, as the earlier May letter did. Each names the second week of November 2024.
- T13 replaces an earlier line that said "too much fruit". "Too much" is on the list of judging words in `neutrality.md`, even though it was about fruit.
- T15 to T17 replace an earlier line about Dad joking about the rent. That line could be read as saying the rent was hard to bear. The new lines are about the flat and the street.

## Price lines (issue #307, updated by spec 18)

Two sentences in `content/personas/letters/eu-tomas.txt` quote a figure from the sealed figures file. Each names the period of its figure: the second week of November 2024 (period 2024-11-11).

- `eu-petrol-euro95`: 1.63 EUR per litre, period 2024-11-11, EU average.
- `eu-diesel`: 1.53 EUR per litre, period 2024-11-11, EU average.

## History: spec 18 replaced the dates this section names.

## Removal of the opening event (spec 10 X4, issue #300)

- Removed: `opening_event` of `eu-tomas`, "European Parliament election", 2024-06-09, from `content/personas/personas.json`. The schema no longer accepts `opening_event`, and the persona UI shows only "Opens {date}" with no event name and no source link.
- Opening date kept: 2024-06-09T00:00:00.000Z, shown as a plain date.
- Reviewer: Jacob Morgan (named in issue #300).
- Result: pending: Jacob Morgan has not yet recorded a pass or fail for the persona copy after this removal.
- Retired phrase: "European Parliament election" is in `RETIRED_PHRASES` in `src/test/retired-phrases.test.ts`. This record quotes it and is excluded from that scan.
