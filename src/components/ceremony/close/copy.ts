// Feature: 07-judge-journey, spec 07 task 6
//
// The Close stage's strings. They moved here from CEREMONY_COPY when the
// stage 3 Steps were retired. Task 3 of this spec rewrites Close and its copy,
// so these stay exactly as they were.
//
// Tone (tone.md) and neutrality (neutrality.md): calm, second person, and the
// same words for any reader. Plain readonly constants only; no JSX here.

export const CLOSE_COPY = {
  /** Heading for the closing stage. */
  title: "That is the whole letter",

  /** Body for the closing stage. */
  body: "Nothing has been added to what you remembered, what was written, or the record.",

  /** The control that returns to the desk. */
  back: "Back to the desk",
} as const;
