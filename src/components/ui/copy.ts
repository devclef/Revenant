// Feature: 08-judge-polish
//
// User-facing strings for the shared site footer (design.md "Copy", R12).
// Tone (tone.md) and neutrality (neutrality.md) apply.
//
// Plain readonly constants only. No JSX lives here.

export const UI_COPY = {
  footer: {
    /** The link to the How_Page. */
    how: "How a letter is sealed",

    /** The link to the source code on GitHub. */
    source: "Source code on GitHub",
  },
} as const;

export type UiCopy = typeof UI_COPY;
