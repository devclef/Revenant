---
inclusion: always
---

# Tone and Visual Voice

Efterhand is the wax seal, resurrected. A sealed letter comes back out of the dark, carried by the ghost of your past self, and before you read it you remember first. The mood is a dark room and one shaft of purple light: something you buried comes back up, carrying your letter. It is spooky the way a quiet night is spooky, not the way a haunted house ride is.

## The feeling

- **Bold, friendly, a little uncanny.** In the Kiro family: confident type, strong light, quick moments. The past is speaking, and it gets to the point.
- **Respectful.** Users are confronting their own memories, sometimes painful ones. Never mock them for misremembering.
- **Plain-spoken.** Atmosphere comes from design and restraint, not from wordplay.

## Copy

- Short sentences. Second person. Calm.
- **One first-person passage:** the maker's story on the home page ("Why I built it") is the only first-person passage in the UI. Everywhere else the second-person rule holds.
- Light, consistent metaphor: *seal*, *sealed*, *open*, *unseal*, *letter*, *record*, *then* and *now*, *remember*, *remember first*, *what you remembered*, *the record*, *see the receipts*. Use these as product vocabulary everywhere.
- Good: "This letter was sealed on 30 October 2026. Before you read it, say what you remember about that autumn."
- Good: "The seal is intact. Nothing here has changed since it was sealed."
- Avoid: puns ("boo-tiful", "spooktacular"), skulls, blood, gore, jump scares, "mwahaha", horror clichés, exclamation marks.
- Words about what the reader remembered stay calm and never accuse. Never use "cross-examine", "caught", "wrong", "you misremembered" or anything that grades what the reader remembered in the UI.
- Data copy stays literal and neutral (see `neutrality.md`). Atmosphere never bends a number or adds a judgement.
- Errors and empty states stay in voice but stay clear: say what happened and what the user can do.
- A question is written by the author, in their own voice and in the present tense ("What worries me most right now?"). The opening screens add the sealing date ("On 19 November 2026 you asked yourself:"), so the question carries no date of its own.
- **Rehearsal:** the 30-second demo says plainly that it is a rehearsal of a letter that would normally stay sealed for months.

## Visual direction

- Near-black background, saturated purple light (about `#8F46FF`), white, and one pumpkin-orange accent. Plenty of negative space.
- The ghost is the concept, not decoration: it is your past self. It is the one Halloween figure we allow. It is our own drawing, a plain sheet ghost, never Kiro's logo or mascot.
- Props stay few and physical: lit soil, the envelope, the wax seal, the letter on warm paper. No desk, candle, parchment texture, moon, gravestones, mounds, crosses or cartoon Halloween props.
- Typography: a very big, heavy sans for headlines, the same clean sans for data and UI, and a serif only for what was sealed: the letter, the author's questions as written and the sealed answers.
- Paper means then: warm paper and the serif hold only what was sealed. Inter on the dark page is for everything else.
- The ghost is part of the column: centred, in the flow, never beside or behind a card. It appears from the moment the letter is unlocked until the seal breaks, then it leaves. It is not on home, `/demo`, Write, Press the seal, Wait or the receipts.
- Orange means "you": the main buttons, the wax, the focus ring, the reader's own answer, what the reader remembered on the receipts screen, the reader's current step on the step track, the press instruction under the seal, the selected backup card, and the numbered question disc (a drop of wax). It never marks a figure, a change or a direction, and it is never text on purple.
- Text on purple is pure white. Body text and all numbers meet WCAG 2.2 AA contrast on the surface they sit on. Dirt, glow and texture are decoration only and never sit on text.
- Motion is quick and deliberate. Every sequence can be skipped, and `prefers-reduced-motion` or the calm control turns all decorative motion off.
- No colour coding that implies a number moved in a good or bad direction.

## Moments that matter

- **Arrival:** dark first, then the light finds the soil. The headline says what Efterhand is before anything moves.
- **Emergence:** the ghost rises out of the soil holding the sealed envelope while the seal is really checked. The letter is offered only once the check has passed.
- **Sealing:** feels final and a little solemn. Make it clear the letter can't be changed after this.
- **Waiting:** the sealed letter is visible but unreadable, held and unopened.
- **Remember:** one question at a time, gentle prompts, no hints about what's inside. One exception, for persona letters only: each figure question may come with one sample answer, labelled as a sample, because the judge never lived the persona's life. For each author question the reader writes what they think they answered. For the text persona the step shows one question and her recollection of her answer at a time, with a plain control to go on. Her recollections are labelled as fictional. The wording never grades them.
- **See the receipts:** each question with what the reader remembered beside the answer sealed with it, then the numbers, then the letter. By then the reader has already read the letter, so on the Receipts step it sits folded after the figures, one control away ("Read the letter again"). A letter with no figures shows the letter in full after the questions. Breaking the seal is the reader's own act. The ghost delivers the letter and leaves; the letter unfolds.
- **Ending:** quiet. Nothing is added to what the reader remembered, what was written, or the record.
- **Locking:** the passkey prompt is the wax seal being pressed. Warnings about lost keys stay plain and unmissable. Atmosphere never softens a warning that could cost the user their letter.
- **Cards:** the letter card and backup key card are printable keepsakes in the same visual language. The backup key card says clearly what it is, that it opens the letter on its own after the opening date, and that it should be kept somewhere safe.
- **Countdown:** scanning early shows a quiet "still sealed" state and the time remaining. Nothing about the contents.
