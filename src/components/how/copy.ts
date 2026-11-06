// Feature: 08-judge-polish (R18)
//
// User-facing strings for the How_Page at /how-it-is-sealed (design.md "How_Page",
// R18). Tone (tone.md) and neutrality (neutrality.md) apply. No exclamation marks.
// Each statement is tied to the code named in the design's table, for the R19
// audit.
//
// Plain readonly constants only. No JSX lives here.

export type HowSection = {
  /** Stable key for React lists and tests. */
  readonly id: string;
  /** The section heading (h2). */
  readonly title: string;
  /** One short paragraph. */
  readonly body: string;
};

export const HOW_COPY = {
  /** The one h1 on the page. It opens the page. */
  heading: "How the seal works",

  /** The column headers of the Seal_Mapping table, which opens the page. */
  mappingHeaders: {
    seal: "The wax seal",
    revenant: "Revenant",
  },

  sections: [
    {
      id: "browser-seals",
      title: "The browser seals the letter",
      body: "Your browser encrypts the letter before anything is sent. The server stores only the encrypted envelope, its unencrypted header and the time-lock secret. It does not receive the letter text in readable form.",
    },
    {
      id: "server-clock",
      title: "The server clock decides",
      body: "The server releases the time-lock secret only when its own clock is at or after the opening date. Your browser clock does not decide. Until then, the letter stays sealed, even for its author. One known limitation: if daylight saving time changes between sealing and opening, the sealed date can move by one day. This happens only to letters sealed in the last hour before local midnight.",
    },
    {
      id: "two-ways-in",
      title: "Two ways in",
      body: "Your passkey and your backup key can each open the letter, but only after the opening date. Neither opens it before. A lost passkey with no backup key means the letter is lost, and Revenant cannot recover it.",
    },
    {
      id: "needs-revenant",
      title: "Opening needs Revenant",
      body: "To open a letter, this Revenant server must release its time-lock secret. If the service or its database is gone, sealed letters cannot be opened. Keep your letter card and any backup key card, because they are how you find the letter again.",
    },
    {
      id: "fingerprint",
      title: "The Fingerprint",
      body: "The Fingerprint is a short code made from the sealed envelope. It is printed on your letter card and shown again when you open the letter. If all 16 groups match, the envelope has not changed since it was sealed.",
    },
    {
      id: "test-letters",
      title: "Test letters",
      body: "Letters sealed on revenant.devclef.se count as test letters. If Revenant moves to another domain, those letters can be opened only on revenant.devclef.se or with their backup key, because passkeys are tied to the domain they were made on.",
    },
  ] as const satisfies readonly HowSection[],
} as const;

export type HowCopy = typeof HOW_COPY;
