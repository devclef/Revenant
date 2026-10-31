import { PageShell, ParchmentSurface, WaxSeal, Wordmark } from "@/components/ui";

/**
 * Landing page. A static server component (no client JS, no inline handlers),
 * built from the shared UI primitives and the globals.css theme tokens.
 *
 * Copy follows tone.md: calm, second person, short sentences, the product
 * vocabulary of seal / letter / open / then / now. It follows neutrality.md:
 * it describes what Revenant does and names no party, policy or judgement, and
 * reads the same to any reader.
 *
 * There is no call-to-action link. The seal and demo flows are not finished, so
 * per the ticket nothing here links to an unfinished feature.
 */
export default function Home() {
  return (
    <PageShell>
      <Wordmark tagline="Your past self returns with the receipts." />

      <ParchmentSurface as="section">
        <WaxSeal />
        <p>
          Revenant is a sealed letter to your future self. You write what is on
          your mind today, and you choose the numbers that matter to you — the
          price of fuel, groceries, rent — each one a real figure from an
          official source, kept with its date and where it came from.
        </p>
        <p>
          You pick a date to open it. Then you seal the letter. Once sealed, it
          cannot be changed, not even by you, and no one else can read it.
        </p>
        <p>
          When that date arrives, the letter opens. First it asks how you
          remember things. Then it shows what you wrote, and the numbers then
          beside the numbers now. The space between the two is yours to read.
        </p>
      </ParchmentSurface>
    </PageShell>
  );
}
