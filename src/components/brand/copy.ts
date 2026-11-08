// Feature: 09-demo-polish (Brand_Copy, framing F1 to F4)
//
// The one source of the framing strings: the eyebrow, the tagline, the hero
// sentence, the five ritual steps and the four seal mapping rows. Copied from
// design.md "Copy" (brand/copy.ts row) and "F. Framing".
//
// Pure module: no React import, so `src/lib/page-metadata.ts` and
// `opengraph-image.tsx` can import it. Tone (tone.md) and neutrality
// (neutrality.md) apply.

export const BRAND_COPY = {
  eyebrow: "The wax seal, resurrected.",
  tagline: "Memory rewrites itself. Revenant doesn't.",
  heroSentence:
    "Seal a letter to your future self with real fuel prices from the US or the EU. When it opens, you testify first, then see the receipts.",
  ritualSteps: [
    {
      name: "Write",
      line: "A letter to your future self, plain text, up to 5,000 characters.",
    },
    {
      name: "Seal the figures",
      line: "Fuel prices from official sources, each with its source, period, unit and region.",
    },
    {
      name: "Press the seal",
      line: "Choose an opening date at least three months away and lock it with your passkey.",
    },
    {
      name: "Testify",
      line: "When it opens, say what you remember before a word is shown.",
    },
    {
      name: "See the receipts",
      line: "Your testimony, then what you wrote, then the numbers then and now.",
    },
  ],
  sealMapping: [
    {
      seal: "Wax that shows whether it was broken",
      revenant: "A SHA-256 hash of the sealed envelope, plus the AES-GCM tag",
    },
    {
      seal: "The folded paper that hides the page",
      revenant: "AES-GCM encryption in your browser; the server holds only ciphertext and the time-lock secret",
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
