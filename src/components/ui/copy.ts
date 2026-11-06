// Feature: 08-judge-polish
//
// User-facing strings for the shared site footer (design.md "Copy", R12).
// Tone (tone.md) and neutrality (neutrality.md) apply.
//
// Plain readonly constants only. No JSX lives here.

export const UI_COPY = {
  /**
   * Strings for BrandedPage, the shared body of the not-found and error pages.
   * Calm and literal (tone.md): say what happened and what the reader can do.
   */
  branded: {
    /** The link to the demo letters, shown on every branded page. */
    demoLink: "Open the demo letters",
  },

  notFound: {
    heading: "This page is not here.",
    body: "Nothing is sealed at this address. Check the link, or go to the demo letters.",
  },

  error: {
    heading: "This page could not be shown.",
    body: "Something failed while the page was loading. Try again in a moment, or go to the demo letters.",
    /** The control that asks the page to render again. */
    retry: "Try again",
  },

  footer: {
    /** The link to the How_Page. */
    how: "How a letter is sealed",

    /** The link to the source code on GitHub. */
    source: "Source code on GitHub",
  },

  /**
   * Page titles and descriptions for the route metadata. Titles are unique per
   * route except the two not-found pages, which share "Not found". The root
   * layout adds the " · Revenant" suffix, so titles here omit it.
   */
  pageMeta: {
    demo: {
      title: "Demo letters",
      description:
        "Demo letters from fictional people. Open one, answer its recall questions, and break the seal.",
    },
    persona: {
      /** `{name}` is replaced with the persona's display name. */
      title: "{name}'s letter",
      description:
        "A demo letter from a fictional person, written as of its date. Open it and break the seal.",
    },
    live: {
      title: "Seal a demo letter",
      description:
        "Seal a short letter with your own passkey, then open it after a 30-second demo lock.",
    },
    letter: {
      title: "Your letter",
      description:
        "A letter sealed with Revenant. It stays closed until its opening date.",
    },
    howItIsSealed: {
      title: "How a letter is sealed",
      description:
        "How a Revenant letter is sealed, what it holds, and what Revenant cannot read.",
    },
    notFound: {
      title: "Not found",
      description: "This page does not exist, or the letter is not here.",
    },
  },
} as const;

export type UiCopy = typeof UI_COPY;
