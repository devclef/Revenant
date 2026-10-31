import { PageShell, ParchmentSurface } from "@/components/ui";
import { DemoLabel } from "@/components/demo/DemoLabel";
import { PersonaCard } from "@/components/demo/PersonaCard";
import { DEMO_COPY } from "@/components/demo/copy";
import { PERSONAS } from "@/lib/personas";
import styles from "./page.module.css";

/**
 * Demo_Index page at `/demo`. A pure server component: no "use client", no
 * state, no database access. It reads the frozen PERSONAS list (validated once
 * at import) and renders a card per persona in list order.
 *
 * Document order (R6.4, R6.5): the "Demo" label and the intro note come before
 * the first card, so they are visible without scrolling on a 360 by 640
 * viewport. Every persona becomes one PersonaCard, and a card receives only
 * list fields (R5.3, R6.2, R16.5) -- never anything from inside the sealed
 * letter. The persona's `key` is passed as `personaKey` because React reserves
 * `key`.
 *
 * When PERSONAS is empty the page shows the `indexEmpty` state and no cards
 * (R6.8). All user-facing words come from copy.ts (R15.1); all dates are
 * formatted inside PersonaCard via dates.ts. Styling uses only globals.css
 * tokens via a co-located CSS module -- AA contrast, no judgement colour
 * (tone.md, neutrality.md).
 */
export default function DemoIndexPage() {
  return (
    <PageShell>
      <DemoLabel />
      <h1 className={styles.heading}>{DEMO_COPY.heading}</h1>
      <p className={styles.introNote}>{DEMO_COPY.introNote}</p>

      {PERSONAS.length === 0 ? (
        <ParchmentSurface as="section">
          <p className={styles.empty}>{DEMO_COPY.indexEmpty}</p>
        </ParchmentSurface>
      ) : (
        <ul className={styles.list}>
          {PERSONAS.map((persona) => (
            <li className={styles.listItem} key={persona.key}>
              <PersonaCard
                personaKey={persona.key}
                display_name={persona.display_name}
                region={persona.region}
                written_as_of={persona.written_as_of}
                opens_at={persona.opens_at}
              />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
