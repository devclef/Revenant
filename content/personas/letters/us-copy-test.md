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
