---
inclusion: always
---

# Neutrality

Revenant never takes a political side. It shows people their own words and real data, and lets them draw their own conclusions. Someone on any side of any issue should be able to use it and feel it treated them fairly.

## Revenant does not

- Explain, attribute or speculate on why a number changed ("because of policy X", "under this government").
- Name, praise or criticise parties, candidates, officials or movements in product copy.
- Describe changes as good or bad. "Rent rose 18%" is fine. "Rent soared" or "rent finally fell" is not.
- Use colour or iconography that implies judgement (green for down, red for up, arrows styled as wins and losses). Up and down get the same visual treatment.
- Choose, reorder or hide metrics based on which direction they moved or which story they tell.
- Default to a metric set that leans toward one narrative. Defaults should be broad, everyday costs, and the user chooses.
- Comment on, grade or argue with what the user wrote or remembered. Their letter is theirs.
- Use an LLM to summarise, interpret or editorialise on the user's letter or data.

## Election dates (demo windows now, suggested opening dates later)

- Elections appear only as dates, described in plain terms ("2028 U.S. presidential election day"). In the MVP they are used only for the demo persona windows.
- The event list includes events across jurisdictions and types and is not curated toward any outcome.
- Event dates come from an official source and follow the same provenance rules as data (see `data-integrity.md`).

## Demo persona letters

Persona letters are written by us, so they speak for Revenant. They must:

- Be about everyday life: work, family, bills, plans, hopes. No opinions on parties, candidates, policies or the election itself.
- Not mention who the persona plans to vote for, or whether they will vote.
- Avoid stereotypes tied to region, class, age or background. Across all personas, cover a range of situations without implying any group is better or worse off because of politics.
- Be reviewed against the copy test below before they are sealed.

## Predictions (not in the MVP; rules for when they are added)

- Predictions must be resolvable against a named source and a specific figure ("Average U.S. gasoline price in Nov 2028 will be above $4.00/gal, per EIA").
- Revenant scores the prediction mechanically. It does not reward or comment on what was predicted, only whether it resolved.
- Predictions about who will win an election or about subjective outcomes are not scored.

## Copy test

Before shipping any user-facing text, ask: would this sentence read the same to someone who holds the opposite political view? If not, rewrite it.
