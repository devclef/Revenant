# US persona copy test: us-maya

Status: copy test record. The US persona must not be sealed or shown as passed until a named reviewer records a pass.

## Persona labels

- Display name: Maya
- Region: United States
- Written as of: 2024-11-17 (plain date, no event name)
- Opens: 2026-11-17T00:00:00.000Z (plain date, no event name)
- Recall subjects:
  - a gallon of regular gasoline (metric_id `us-gasoline-regular`)
  - a gallon of diesel (metric_id `us-diesel`)

## Texts under review

1. The letter, `content/personas/letters/us-maya.txt`. Not repeated here, so the file has one source.
2. The `intro_line` of `us-maya` in `content/personas/personas.json`:
   "Maya, who works early shifts at a clinic, writes on a November Sunday about her commute, filling the tank and Saturday deliveries."

## Copy test record (neutrality.md)

Reviewer: Jacob Morgan
Result: pending

The US persona must not be sealed until a named reviewer records a pass. The agent did not record a pass.

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

- Production_Check: not run by the agent.
- Real_Device_Check: not run by the agent.

## Agent self-check (does not count as a pass)

This is the agent's own reading of the checklist above. It is not a pass. Jacob Morgan's result is pending for every row.

Expected answers in order: **Y N N N N Y Y N**. Each row gives the agent's answers in the same order.

| # | Sentence | Agent | Same as expected |
|---|---|---|---|
| M1 | Dear future me, | Y N N N N Y Y N | yes |
| M2 | It is a Sunday evening in November, and it was dark before supper. | Y N N N N Y Y N | yes |
| M3 | The maple next door dropped the last of its leaves this week. | Y N N N N Y Y N | yes |
| M4 | I wanted to write this down before the week starts again. | Y N N N N Y Y N | yes |
| M5 | Work is steady. | Y N N N N Y Y N | yes |
| M6 | The early shifts at the clinic are hard on the alarm clock, and now I leave the house in the dark, but I like the quiet drive in, when the roads are empty and the frost is still on the fields. | Y N N N N Y Y N | yes |
| M7 | I fill the tank on Thursdays at the station by the bridge. | Y N N N N Y Y N | yes |
| M8 | On the radio this morning they said the national average for regular was about $3.05 a gallon in the second week of November. | Y N N N N Y Y N | yes |
| M9 | I have started keeping the receipts in the glove box, though I never look at them. | Y N N N N Y Y N | yes |
| M10 | On Saturdays I ride along with Jess in her van for the bakery deliveries. | Y N N N N Y Y N | yes |
| M11 | She drives, I carry the trays, and we eat the broken scones on the way home with the heater on. | Y N N N N Y Y N | yes |
| M12 | The radio put diesel at about $3.52 a gallon in the second week of November, which is what the van runs on. | Y N N N N Y Y N | yes |
| M13 | She says she wants a second van one day. | Y N N N N Y Y N | yes |
| M14 | I hope she gets it. | Y N N N N Y Y N | yes |
| M15 | Mom's knee is healing. | Y N N N N Y Y N | yes |
| M16 | We are planning to drive out to the lake once the weather turns, all of us, if the car holds up. | Y N N N N Y Y N | yes |
| M17 | I keep saying I will learn to fix the small things on it myself. | Y N N N N Y Y N | yes |
| M18 | Maybe by the time you read this, I will have. | Y N N N N Y Y N | yes |
| M19 | The bills are paid this month, with a little left over. | Y N N N N Y Y N | yes |
| M20 | I would like to put some aside for an evening class after the winter. | Y N N N N Y Y N | yes |
| M21 | I have not decided which one yet. | Y N N N N Y Y N | yes |
| M22 | I don't know what you will remember of this fall. | Y N N N N Y Y N | yes |
| M23 | I think you will remember the maple. | Y N N N N Y Y N | yes |
| M24 | Love, Maya | Y N N N N Y Y N | yes |
| I1 | Intro line of `us-maya` | Y N N N N Y Y N | yes |

**Points for the reviewer.**

- M8 and M12 quote the national average, as the earlier May letter did. The figures are EIA's, and the receipts show their source.
- M19 mentions money left over after the bills. It describes the persona's month and does not grade any price.
- The written-as-of month, November 2024, was U.S. election month. No text names it or any public event. The Memory_Line "You lived through November 2024 too. Answer from your own memory of it." names only the month.

## Price lines (issue #307, updated by spec 18)

Two sentences in `content/personas/letters/us-maya.txt` quote a figure from the sealed figures file. Each names the period of its figure: the second week of November 2024 (period 2024-11-11).

- `us-gasoline-regular`: 3.05 USD per gallon, period 2024-11-11, national average.
- `us-diesel`: 3.52 USD per gallon, period 2024-11-11.

## History: spec 18 replaced the dates this section names.

### Removal of the opening event (spec 10 X4, issue #300)

- Removed: `opening_event` of `us-maya`, "U.S. presidential election day", 2024-11-05, from `content/personas/personas.json`. The schema no longer accepts `opening_event`, and the persona UI shows only "Opens {date}" with no event name and no source link.
- Opening date kept: 2024-11-05T00:00:00.000Z, shown as a plain date.
- Reviewer: Jacob Morgan (named in issue #300).
- Result: pending: Jacob Morgan has not yet recorded a pass or fail for the persona copy after this removal.
- Retired phrase: "U.S. presidential election day" is in `RETIRED_PHRASES` in `src/test/retired-phrases.test.ts`. This record quotes it and is excluded from that scan.
