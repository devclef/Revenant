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
  tagline: "Memory rewrites itself. Revenant doesn't.",
  heroSentence:
    "Seal what you believe now, a goal, a worry, a decision. When it opens, you testify first, then read what you wrote.",
  ritualSteps: [
    {
      name: "Write",
      line: "A letter to your future self, plain text. Add up to three questions and an optional receipt.",
    },
    {
      name: "Press the seal",
      line: "Lock the letter with your passkey. The live demo locks it for 30 seconds.",
    },
    {
      name: "Testify",
      line: "When it opens, say what you remember before a word is shown.",
    },
    {
      name: "See the receipts",
      line: "Your testimony, then what you wrote, then any numbers then and now.",
    },
  ],
  sealMapping: [
    {
      seal: "Wax that shows whether it was broken",
      revenant: "A SHA-256 hash of the sealed envelope, plus the AES-GCM tag",
    },
    {
      seal: "The folded paper that hides the page",
      revenant: "AES-GCM encryption in your browser; the server stores ciphertext, never the letter text",
    },
    {
      seal: "The signet ring that made it yours",
      revenant: "A passkey (WebAuthn PRF), with an optional backup key card",
    },
    {
      seal: "The archivist who won't open it early",
      revenant: "A server time lock that releases its half of the key on the opening date",
    },
  ],
} as const;
