# US persona copy test: us-maya

Status: copy test record. The US persona must not be sealed or shown as passed until a named reviewer records a pass.

## Full text of content/personas/letters/us-maya.txt

See `content/personas/letters/us-maya.txt`. The letter text is not repeated here, so the file has one source.

## Persona labels

- Display name: Maya
- Region: United States
- Written as of: 2024-05-12
- Opens: 2024-11-05T00:00:00.000Z (U.S. presidential election day, 2024-11-05)
- Recall subjects:
  - a gallon of regular gasoline (metric_id `us-gasoline-regular`)
  - a gallon of diesel (metric_id `us-diesel`)

## Copy test record (neutrality.md)

Reviewer: pending: a named human reviewer must record pass or fail
Result: not yet passed: pending: a named human reviewer must record pass or fail

No reviewer has run the copy test on this persona. The agent did not fill in a reviewer name or a pass.

### Texts under review

The copy test covers these three pieces of user-facing text:

1. `intro_line` of `us-maya` in `content/personas/personas.json`:
   "Maya, who works early shifts at a clinic, writes on a May Sunday about her commute, filling the tank and Saturday deliveries."
2. `intro_line` of `eu-tomas` in `content/personas/personas.json`:
   "Tomás, who works shifts at a hospital pharmacy, writes on a May Sunday about his commute, the car and the market with Inês."
3. `opening_event` of `us-maya` in `content/personas/personas.json`:
   name "U.S. presidential election day", date 2024-11-05, source "U.S. National Archives", source_url https://www.archives.gov/electoral-college/2024

### Reviewer checklist (neutrality.md)

The reviewer reads each text above and answers each question for every sentence:

1. Would this sentence read the same to someone who holds the opposite political view?
2. Does the text name, praise or criticise any party, candidate, official or movement? (Expected: no.)
3. Does the text say who the persona will vote for, or whether they will vote? (Expected: no.)
4. Does the text explain or attribute a price or cost change to a cause, policy or government? (Expected: no.)
5. Does the text describe any cost as good or bad, or as rising or falling in a loaded way? (Expected: no.)
6. Does the text avoid stereotypes tied to region, class, age, nationality or background? (Expected: yes.)
7. Is the text about everyday life only: work, family, bills, plans and hopes? (Expected: yes.)
8. For `opening_event`: is the date a plain public calendar date, with no claim about who wins or what the election means? (Expected: yes.)

Any answer that differs from the expected one blocks the pass. The reviewer then records the issue here, and the copy is rewritten before a new review.

### Owner checks not run by the agent

- Production_Check: not run by the agent.
- Real_Device_Check: not run by the agent.
- EU Europarl link check in a browser (`https://www.europarl.europa.eu/elections/en/`): not run by the agent.

## opening_event values (content/personas/personas.json)

Persona `us-maya`:

- `name`: U.S. presidential election day
- `date`: 2024-11-05
- `source`: U.S. National Archives
- `source_url`: https://www.archives.gov/electoral-college/2024

The opening date is a plain public calendar date. It does not follow the event if the event moves.

## Removal of the opening event (spec 10 X4, issue #300)

- Removed: `opening_event` of `us-maya`, "U.S. presidential election day", 2024-11-05, from `content/personas/personas.json`. The schema no longer accepts `opening_event`, and the persona UI shows only "Opens {date}" with no event name and no source link.
- Opening date kept: 2024-11-05T00:00:00.000Z, shown as a plain date.
- Reviewer: Jacob Morgan (named in issue #300).
- Result: pending: Jacob Morgan has not yet recorded a pass or fail for the persona copy after this removal.
- Retired phrase: "U.S. presidential election day" is in `RETIRED_PHRASES` in `src/test/retired-phrases.test.ts`. This record quotes it and is excluded from that scan.

## Price lines added to us-maya (issue #307)

Two sentences in `content/personas/letters/us-maya.txt` quote a figure from the sealed figures file. They are the only new text in this change.

- Reviewer requested: Jacob Morgan (copy-test reviewer named in issue #307).
- Result: pending: Jacob Morgan has not yet recorded a pass or fail for these sentences.

The agent below ran the neutrality.md checklist on each sentence. This self-check is not a human review and does not count as a pass. Only the named reviewer records the pass.

| Question (neutrality.md) | Sentence 1: regular | Sentence 2: diesel |
|---|---|---|
| Sentence text | "On the radio this morning they said the national average for regular was about $3.64 a gallon in the first week of May." | "The radio put diesel at about $3.89 a gallon in the first week of May, which is what the van runs on." |
| 1. Reads the same to the opposite view? | Yes | Yes |
| 2. Names a party, candidate, official or movement? | No | No |
| 3. Says who the persona votes for or whether they vote? | No | No |
| 4. Attributes a price change to a cause, policy or government? | No | No |
| 5. Calls a cost good or bad, or rising or falling in a loaded way? | No | No |
| 6. Avoids stereotypes tied to region, class, age, nationality or background? | Yes | Yes |
| 7. About everyday life only? | Yes | Yes |

Question 8 (`opening_event`) does not apply to these sentences. Both figures are shown with their own period and unit in the sealed figures file; the letter-prices test in issue #307 checks that they match it.

Agent self-check result: all answers match the expected answer. Pending a named human pass from Jacob Morgan.

Wording change: the first version said "this week", which gave the reader no period for the figure. The sentences now name the period of the sealed figure: the first week of May (the figure's period is 2024-05-06, and digits are not allowed outside price phrases). Jacob Morgan reviews the sentences as quoted here.
