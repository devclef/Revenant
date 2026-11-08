import { DemoLabel } from "@/components/demo/DemoLabel";
import { LiveEntry } from "@/components/demo/LiveEntry";
import { PersonaCard } from "@/components/demo/PersonaCard";
import { DEMO_COPY } from "@/components/demo/copy";
import { SceneShell } from "@/components/ceremony/scene/SceneShell";
import { SceneHeadline } from "@/components/ceremony/scene/SceneHeadline";
import { SCENE_COPY } from "@/components/ceremony/scene/copy";
import { PERSONAS } from "@/lib/personas";
import { pageMetadata } from "@/lib/page-metadata";
import { UI_COPY } from "@/components/ui/copy";
import styles from "./page.module.css";

export const metadata = pageMetadata(UI_COPY.pageMeta.demo, "/demo");

/**
 * Demo_Index page at `/demo`. A server component with no database access. It
 * reads the frozen PERSONAS list (validated once at import) and lays it out on
 * the Scene (`SceneShell variant="index"`): the dark background, the Top_Bar and
 * the Soil backdrop, with no Ghost.
 *
 * Order on the page: the "Demo" label, the heading, the intro note, then one
 * envelope per persona in list order, or the empty state when the list is
 * empty. The live demo entry (`/demo/live`) sits after the list, with or without
 * personas. A card receives only list fields (R5.3, R6.2, R16.5), never anything
 * from inside the sealed letter. The persona's `key` is passed as `personaKey`
 * because React reserves `key`.
 *
 * SceneShell supplies the motion provider, so this page needs no provider of
 * its own. The first render is the settled Scene with no JavaScript, so the
 * static page and the same cards show with scripts disabled.
 *
 * All user-facing words come from copy.ts (R15.1).
 */
export default function DemoIndexPage() {
  return (
    <SceneShell variant="index">
      <div className={styles.page}>
        <div className={styles.label}>
          <DemoLabel />
        </div>
        <SceneHeadline text={SCENE_COPY.demoHeading} />
        <p className={styles.introNote} data-dust-ceiling>
          {DEMO_COPY.introNote}
        </p>

        {PERSONAS.length === 0 ? (
          <section>
            <p className={styles.empty}>{DEMO_COPY.indexEmpty}</p>
          </section>
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

        <LiveEntry />
      </div>
    </SceneShell>
  );
}
