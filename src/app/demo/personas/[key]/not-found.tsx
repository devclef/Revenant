import Link from "next/link";
import { PageShell, ParchmentSurface } from "@/components/ui";
import { DemoLabel } from "@/components/demo/DemoLabel";
import { DEMO_COPY } from "@/components/demo/copy";
import styles from "./not-found.module.css";

/**
 * Persona not-found page, rendered by Next.js when `page.tsx` calls
 * `notFound()` because the `[key]` route segment is not a known persona.
 *
 * A pure server component: no "use client", no state, no data access. It makes
 * no API request and imports no crypto (R16.5, tech.md: lib/crypto is
 * browser-only and never reached from a server route). Every word comes from
 * copy.ts, so this page holds no inline literals (R15.1).
 *
 * It shows the "Demo" label, the not-found title and body, and a link back to
 * the demo letters index at `/demo` -- an empty state that names an action so
 * the reader knows what to do next (tone.md). Styling uses only globals.css
 * tokens via a co-located CSS module (neutrality.md: no judgement colour; AA
 * contrast).
 */
export default function PersonaNotFound() {
  return (
    <PageShell>
      <DemoLabel />
      <ParchmentSurface as="section">
        <h1 className={styles.title}>{DEMO_COPY.notFoundTitle}</h1>
        <p className={styles.body}>{DEMO_COPY.notFoundBody}</p>
        <Link className={styles.back} href="/demo">
          {DEMO_COPY.backToDemo}
        </Link>
      </ParchmentSurface>
    </PageShell>
  );
}
