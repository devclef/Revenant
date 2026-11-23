# US persona copy test: us-priya

Status: copy test record. The Text_Persona must not be shown as passed until a named reviewer records a pass.

## Persona labels

- Display name: Priya
- Region: United States
- Written as of: 2024-11-17 (plain date, no event name)
- Opens: 2026-11-17T00:00:00.000Z (plain date, no event name)
- Metrics: none. This is a Text_Persona: no figures, and her answers are pre-written content.

## Texts under review

1. The letter, `content/personas/letters/us-priya.txt`. Not repeated here, so the file has one source.
2. The two sealed answers, `content/personas/letters/sealed-answers.json` under `us-priya` (format v2). They are sealed with her two questions and are shown beside the reader's recollection at opening.
3. The two recollections, `content/personas/letters/answers.json` under `us-priya`. These are fictional and are shown only as labelled fictional recollections. They are never sealed or stored.
4. The two author questions in `content/personas/personas.json` under `us-priya`:
   - "What am I looking forward to most right now?"
   - "What am I worried about right now?"
5. The `intro_line` of `us-priya` in `content/personas/personas.json`:
   "Priya, who teaches a Saturday class, writes on a November Sunday about her week, a plan with her sister and a choice at work."

The wording of items 2 to 4 is the owner-approved copy in `docs/design/15-flow/README.md`, section "Priya: copy for the owner to approve". It is not reworded here.

## Copy test record (neutrality.md)

Reviewer: Jacob Morgan
Result: pending

The Text_Persona must not be shown as passed until a named reviewer records a pass. The agent did not record a pass.

### Reviewer checklist (neutrality.md)

The reviewer reads each text above and answers each question for every sentence:

1. Would this sentence read the same to someone who holds the opposite political view?
2. Does the text name, praise or criticise any party, candidate, official or movement? (Expected: no.)
3. Does the text say who the persona will vote for, or whether they will vote? (Expected: no.)
4. Does the text explain or attribute a cost change to a cause, policy or government? (Expected: no.)
5. Does the text describe any cost as good or bad? (Expected: no.)
6. Does the text avoid stereotypes tied to region, class, age, nationality or background? (Expected: yes.)
7. Is the text about everyday life only: work, family, bills, plans and hopes? (Expected: yes.)
8. Does the text name an election, a vote, a public holiday or any other public event? (Expected: no.)
9. For the answers, the sealed answers and the recollections: does each answer avoid grading the letter, the memory or the reader, and avoid any reference to the letter or to changing a mind? (Expected: yes.)

Any answer that differs from the expected one blocks the pass. The reviewer records the issue here, and the copy is rewritten before a new review.

Point for the reviewer, found by the agent when reading the copy against the rules:

- Sealed answer 2 reads "I keep changing my mind". Under question 9 the expected answer is yes, so this sentence is expected to fail the rule as written. The approved copy is not reworded, so the reviewer records whether it passes. `checkAnswerText` (`ANSWER_MIND_REGEX` in `letter-checks.ts`) rejects that phrase until the next task of this spec adds the sealed-answer exception.
- Both approved questions use "right now". The current `tone.md` does not forbid "right now". The reviewer decides under the current `tone.md`.

## Agent self-check (does not count as a pass)

This is the agent's own reading of the checklist above. It is not a pass. Jacob Morgan's result is pending for every row.

Expected answers in order: **Y N N N N Y Y N**. Each row gives the agent's answers in the same order.

| # | Sentence or text | Agent | Same as expected |
|---|---|---|---|
| P1 | Dear Priya, | Y N N N N Y Y N | yes |
| P2 | It is a Sunday in November, and the house is quiet before the week starts. | Y N N N N Y Y N | yes |
| P3 | The light goes early now, so the lamp is on by four in the afternoon. | Y N N N N Y Y N | yes |
| P4 | I am writing this so you can see what the week looked like from here. | Y N N N N Y Y N | yes |
| P5 | The Saturday class is going well. | Y N N N N Y Y N | yes |
| P6 | The children have started asking questions I cannot answer yet, and I am trying to take that as a good sign. | Y N N N N Y Y N | yes |
| P7 | I have a new reading list and I am a little behind on it. | Y N N N N Y Y N | yes |
| P8 | My sister and I are planning a weekend at the coast in the winter, when the beaches are empty. | Y N N N N Y Y N | yes |
| P9 | She wants to drive and I want the train, so we are looking for a way that suits us both. | Y N N N N Y Y N | yes |
| P10 | I hope we have managed it by the time you read this. | Y N N N N Y Y N | yes |
| P11 | At work there is a choice in front of me: whether to take the extra morning shift or keep my weekday evenings free. | Y N N N N Y Y N | yes |
| P12 | I keep changing my mind. | Y N N N N Y Y N | yes |
| P13 | I hope that by the time you open this letter I will have chosen the thing I wanted, and not the thing I felt I ought to want. | Y N N N N Y Y N | yes |
| P14 | Mostly I want you to know that I was tired but hopeful. | Y N N N N Y Y N | yes |
| P15 | I hope you still have the Saturday mornings, the coffee on the step with a coat on, and the long phone calls with my sister. | Y N N N N Y Y N | yes |
| P16 | Write back if you like. | Y N N N N Y Y N | yes |
| P17 | Priya | Y N N N N Y Y N | yes |
| I1 | Intro line of `us-priya` | Y N N N N Y Y N | yes |
| Q1 | Question 1 of `us-priya` | Y N N N N Y Y N | yes |
| Q2 | Question 2 of `us-priya` | Y N N N N Y Y N | yes |
| A1 | Sealed answer 1 of `us-priya` | Y N N N N Y Y N | yes |
| A2 | Sealed answer 2 of `us-priya` | Y N N N N Y Y N | yes |
| R1 | Recollection 1 of `us-priya` | Y N N N N Y Y N | yes |
| R2 | Recollection 2 of `us-priya` | Y N N N N Y Y N | yes |
| S1 | `REVEAL_COPY.sealedForThisDemo` "Sealed later, for this demo, on {sealedAt}." | Y N N N N Y Y N | yes |

**Points for the reviewer.** No row differs from the expected answer, apart from the point above about sealed answer 2.

## Owner checks not run by the agent

- Real_Device_Check: not run by the agent.
