// Feature: 09-demo-polish (Brand_Copy, framing F1 to F4)
//
// The one source of the framing strings: the eyebrow, the tagline, the hero
// sentence, the four ritual steps and the four seal mapping rows. Copied from
// design.md "Copy" (brand/copy.ts row) and "F. Framing".
//
// Pure module: no React import, so `src/lib/page-metadata.ts` and
// `opengraph-image.tsx` can import it. Tone (tone.md) and neutrality
// (neutrality.md) apply.

export const BRAND_COPY = {
  eyebrow: "The wax seal, resurrected.",
  tagline: "Memory drifts with time. A sealed letter doesn't.",
  heroSentence:
    "Seal what you believe now, a goal, a worry, a decision. When it opens, you remember first, then read what you wrote.",
  ritualSteps: [
    {
      name: "Write",
      line: "A letter to your future self, plain text. Add up to three questions, answer them now, and add an optional receipt.",
    },
    {
      name: "Press the seal",
      line: "Lock the letter with your passkey. The live demo locks it for 30 seconds.",
    },
    {
      name: "Remember",
      line: "When it opens, write what you think you answered, before a word is shown.",
    },
    {
      name: "Receipts",
      line: "What you remembered beside what you wrote, then any numbers then and now.",
    },
  ],
  sealMapping: [
    {
      seal: "Wax that shows whether it was broken",
      efterhand: "A SHA-256 hash of the sealed envelope, plus the AES-GCM tag",
    },
    {
      seal: "The folded paper that hides the page",
      efterhand: "AES-GCM encryption in your browser; the server stores ciphertext, never the letter text",
    },
    {
      seal: "The signet ring that made it yours",
      efterhand: "A passkey (WebAuthn PRF), with an optional backup key card",
    },
    {
      seal: "The archivist who won't open it early",
      efterhand: "A server time lock that releases its half of the key on the opening date",
    },
  ],
} as const;
