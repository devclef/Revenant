import { ParchmentSurface } from "@/components/ui";
import { DemoLabel } from "@/components/demo/DemoLabel";
import { PersonaCard } from "@/components/demo/PersonaCard";
import { DEMO_COPY } from "@/components/demo/copy";
import { DeskScene } from "@/components/ceremony/desk/DeskScene";
import { MotionProvider } from "@/components/ceremony/motion";
import { PERSONAS } from "@/lib/personas";
import styles from "./page.module.css";

/**
 * Demo_Index page at `/demo`. A server component with no database access. It
 * reads the frozen PERSONAS list (validated once at import) and lays it out on
 * the dark desk, the same surface the persona letter sits on.
 *
 * Desk order (R6.4, R6.5): the "Demo" label, the heading and the intro note come
 * before the first envelope, so they show without scrolling on a 360 by 640
 * viewport. Each persona is one PersonaCard (a desk envelope), in list order. A
 * card receives only list fields (R5.3, R6.2, R16.5), never anything from inside
 * the sealed letter. The persona's `key` is passed as `personaKey` because React
 * reserves `key`.
 *
 * The page renders one MotionProvider around DeskScene, the single motion owner
 * for this visit, as the persona page does. The first render is the settled desk
 * with no JavaScript, so the static desk and the same cards show with scripts
 * disabled.
 *
 * When PERSONAS is empty the desk shows the `indexEmpty` state with no envelopes
 * (R6.8). All user-facing words come from copy.ts (R15.1).
 */
export default function DemoIndexPage() {
  return (
    <MotionProvider>
      <DeskScene>
        <div className={styles.page}>
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
        </div>
      </DeskScene>
    </MotionProvider>
  );
}
