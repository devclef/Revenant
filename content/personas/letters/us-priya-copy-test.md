# US persona copy test: us-priya

Status: copy test record. The Text_Persona must not be shown as passed until a named reviewer records a pass.

## Texts under review

1. The letter, `content/personas/letters/us-priya.txt`. Not repeated here, so the file has one source.
2. The two sealed answers, `content/personas/letters/sealed-answers.json` under `us-priya` (format v2). They are sealed with her two questions and are shown beside the reader's recollection at opening.
3. The two recollections, `content/personas/letters/answers.json` under `us-priya`. These are fictional and are shown only as labelled fictional recollections. They are never sealed or stored.
4. The two author questions in `content/personas/personas.json` under `us-priya`:
   - "What am I looking forward to most right now?"
   - "What am I worried about right now?"
5. The `intro_line` of `us-priya` in `content/personas/personas.json`:
   "Priya, who teaches a Saturday class, writes in May about her week, a plan with her sister and a choice at work."

The wording of items 2 to 4 is the owner-approved copy in `docs/design/15-flow/README.md`, section "Priya: copy for the owner to approve". It is not reworded here.

## Persona labels

- Display name: Priya
- Region: United States
- Written as of: 2024-05-12
- Opens: 2024-11-05T00:00:00.000Z (plain date, no event name)
- Metrics: none. This is a Text_Persona: no figures, and her answers are pre-written content.

## Copy test record (neutrality.md)

Reviewer: Jacob Morgan (copy-test reviewer named in issues #300 and #307)
Result: pending: Jacob Morgan has not yet recorded a pass or fail for this persona. The agent did not record a pass.

The reviewer reads each text above and answers each question for every sentence:

1. Would this sentence read the same to someone who holds the opposite political view?
2. Does the text name, praise or criticise any party, candidate, official or movement? (Expected: no.)
3. Does the text say who the persona will vote for, or whether they will vote? (Expected: no.)
4. Does the text explain or attribute a cost change to a cause, policy or government? (Expected: no.)
5. Does the text describe any cost as good or bad? (Expected: no.)
6. Does the text avoid stereotypes tied to region, class, age, nationality or background? (Expected: yes.)
7. Is the text about everyday life only: work, family, bills, plans and hopes? (Expected: yes.)
8. For the answers, the sealed answers and the recollections: does each answer avoid grading the letter, the memory or the reader, and avoid any reference to the letter or to changing a mind? (Expected: yes.)

Point for the reviewer to decide, found by the agent when reading the copy against the rules:

- Sealed answer 2 reads "I keep changing my mind". Under question 8 the expected answer is yes, so this sentence is expected to fail the rule as written. The approved copy is not reworded, so the reviewer records whether it passes. `checkAnswerText` (`ANSWER_MIND_REGEX` in `letter-checks.ts`) rejects that phrase until the next task of this spec adds the sealed-answer exception.
- Both approved questions use "right now". The current `tone.md` does not forbid "right now". The proposed steering change in the README would forbid it. The reviewer decides under the current `tone.md`.

Any answer that differs from the expected one blocks the pass. The reviewer records the issue here, and the copy is rewritten before a new review.

## Agent self-check (not a human review)

The agent checked the letter and the answers against the rules in `checkAnswerText` and `checkLetterText`: no digits, currency, election or party terms, verdict words, or references to the letter, remembering, forgetting or changing a mind. This self-check is not a pass and does not count as one.

## Owner checks not run by the agent

- Real_Device_Check: not run by the agent.
