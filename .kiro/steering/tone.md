---
inclusion: always
---

# Tone and Visual Voice

Revenant is the wax seal, resurrected. A sealed letter comes back out of the dark, carried by the ghost of your past self, and before you read it you testify. The mood is a dark room and one shaft of purple light: something you buried comes back up, carrying your letter. It is spooky the way a quiet night is spooky, not the way a haunted house ride is.

## The feeling

- **Bold, friendly, a little uncanny.** In the Kiro family: confident type, strong light, quick moments. The past is speaking, and it gets to the point.
- **Respectful.** Users are confronting their own memories, sometimes painful ones. Never mock them for misremembering.
- **Plain-spoken.** Atmosphere comes from design and restraint, not from wordplay.

## Copy

- Short sentences. Second person. Calm.
- Light, consistent metaphor: *seal*, *sealed*, *open*, *unseal*, *letter*, *record*, *then* and *now*, *testify*, *testimony*, *the record*, *see the receipts*. Use these as product vocabulary everywhere.
- Good: "This letter was sealed on 30 October 2026. Before you read it, testify: say what you remember about that autumn."
- Good: "The seal is intact. Nothing here has changed since it was sealed."
- Avoid: puns ("boo-tiful", "spooktacular"), skulls, blood, gore, jump scares, "mwahaha", horror clichés, exclamation marks.
- Testimony words stay calm and never accuse. Never use "cross-examine", "caught", "wrong", "you misremembered" or anything that grades the testimony in the UI.
- Data copy stays literal and neutral (see `neutrality.md`). Atmosphere never bends a number or adds a judgement.
- Errors and empty states stay in voice but stay clear: say what happened and what the user can do.
- A question is written for the reader on the opening day and names the sealing day ("when you wrote this", "the day you sealed this"). It never says "right now", "today" or "currently".
- **Rehearsal:** the 30-second demo says plainly that it is a rehearsal of a letter that would normally stay sealed for months.

## Visual direction

- Near-black background, saturated purple light (about `#8F46FF`), white, and one pumpkin-orange accent. Plenty of negative space.
- The ghost is the concept, not decoration: it is your past self. It is the one Halloween figure we allow. It is our own drawing, a plain sheet ghost, never Kiro's logo or mascot.
- Props stay few and physical: lit soil, the envelope, the wax seal, the letter on warm paper. No desk, candle, parchment texture, moon, gravestones, mounds, crosses or cartoon Halloween props.
- Typography: a very big, heavy sans for headlines, the same clean sans for data and UI, and a serif for the letter text only.
- Orange means "you": the main buttons, the wax, the focus ring and the reader's own answer. It never marks a figure, a change or a direction, and it is never text on purple.
- Text on purple is pure white. Body text and all numbers meet WCAG 2.2 AA contrast on the surface they sit on. Dirt, glow and texture are decoration only and never sit on text.
- Motion is quick and deliberate. Every sequence can be skipped, and `prefers-reduced-motion` or the calm control turns all decorative motion off.
- No colour coding that implies a number moved in a good or bad direction.

## Moments that matter

- **Arrival:** dark first, then the light finds the soil. The headline says what Revenant is before anything moves.
- **Emergence:** the ghost rises out of the soil holding the letter while the seal is really checked. The letter is offered only once the check has passed.
- **Sealing:** feels final and a little solemn. Make it clear the letter can't be changed after this.
- **Waiting:** the sealed letter is visible but unreadable, held and unopened.
- **Testify:** one question at a time, gentle prompts, no hints about what's inside. One exception, for persona letters only: each figure question may come with one sample answer, labelled as a sample, because the judge never lived the persona's life. For the text persona the step shows one question and her answer at a time, with a plain control to go on. Her answers are labelled as fictional. The wording never grades them.
- **See the receipts:** testimony first, then the letter, then the numbers. Breaking the seal is the reader's own act. The ghost delivers the letter and leaves; the letter unfolds.
- **Ending:** quiet. Nothing is added to what the reader remembered, what was written, or the record.
- **Locking:** the passkey prompt is the wax seal being pressed. Warnings about lost keys stay plain and unmissable. Atmosphere never softens a warning that could cost the user their letter.
- **Cards:** the letter card and backup key card are printable keepsakes in the same visual language. The backup key card says clearly what it is, that it opens the letter on its own after the opening date, and that it should be kept somewhere safe.
- **Countdown:** scanning early shows a quiet "still sealed" state and the time remaining. Nothing about the contents.
