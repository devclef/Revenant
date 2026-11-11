import { notFound } from "next/navigation";
import { OpeningFlow } from "@/components/reveal/OpeningFlow";
import { SceneShell } from "@/components/ceremony/scene/SceneShell";
import { PersonaIntroForStage } from "@/components/ceremony/intro/PersonaIntroForStage";
import { PERSONAS, sampleCandidatesFor } from "@/lib/personas";
import { pageMetadata } from "@/lib/page-metadata";
import { UI_COPY } from "@/components/ui/copy";
import type { Metadata } from "next";

/**
 * Title for one persona letter: "{name}'s letter". An unknown key gets the
 * not-found title, matching the page's notFound() call.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const persona = PERSONAS.find((p) => p.key === key);
  if (persona === undefined) {
    return pageMetadata(UI_COPY.pageMeta.notFound, "/demo");
  }
  return pageMetadata(
    {
      title: UI_COPY.pageMeta.persona.title.replace("{name}", persona.display_name),
      description: UI_COPY.pageMeta.persona.description,
    },
    `/demo/personas/${persona.key}`,
  );
}

/**
 * Persona letter route at `/demo/personas/[key]` (design.md "Persona route",
 * spec 03-persona-demo Task 7).
 *
 * A pure server component. It awaits `params`, looks the `[key]` segment up in
 * the frozen PERSONAS list, and calls `notFound()` when no persona matches --
 * Next.js then renders the co-located `not-found.tsx`. When a persona is found
 * it renders the "Demo" label and the client `OpeningFlow`, which drives the
 * whole opening ceremony (countdown, unseal, recall, reveal).
 *
 * The desk (design.md "How the Ceremony wraps the flow"): `DeskScene` replaces
 * the old `PageShell` as the wrapper, so every view sits on the dark desk
 * rather than a bare paper column. `DeskScene` is a client component that reads
 * the motion mode, so the page renders one `MotionProvider` around it -- the
 * single motion owner for this page visit (design.md "State ownership"). The
 * page itself stays a server component: a server component may render a client
 * provider and a client wrapper, and does so here without any client hook of
 * its own. The server (and first client) render reports `full` motion and the
 * settled desk, so the first paint is the static desk with no JavaScript
 * (R13.4) and hydration never mismatches (R17.3). `DemoLabel` stays the first
 * child so the "Demo" badge is visible above the fold, before the heading
 * (R6.5).
 *
 * The scene feeds OpeningFlow the persona's list fields (`key`,
 * `written_as_of`, `opens_at`) through the optional `persona` prop, for the
 * envelope (R3.7) and the seal pattern (R8.4). These feed the scene only; the
 * letter id still comes solely from `letterId` (R16.5).
 *
 * Letter ID provenance (R16.5): `letterId` is taken ONLY from the persona list
 * entry, never from the URL or any request input, so the route can only open a
 * letter the committed list names. `personaName` is the list's display name,
 * used by OpeningFlow for the region's accessible label.
 *
 * Crypto boundary (R14.6, tech.md: lib/crypto is browser-only): this server
 * module imports only the persona list and presentational components. It never
 * imports `@/lib/crypto`; crypto is reached only through the dynamic `import()`
 * inside `useOpeningFlow`, on the client. The import-boundary test enforces
 * that the demo route pulls no crypto into a static import graph.
 *
 * `dynamicParams = true` and no `generateStaticParams`: keys are resolved at
 * request time against PERSONAS, so a new persona needs no build-time list and
 * an unknown key reaches `notFound()` rather than a static 404.
 */
export const dynamicParams = true;

/**
 * Read per request, never at build time (spec 07 task 6, design.md
 * "Demo_2_On plumbing"). The same read and trim as `demo/live/page.tsx`. Only
 * this boolean is passed down; RP_ID itself never reaches the client (R15.9).
 */
export const dynamic = "force-dynamic";

export default async function PersonaLetterPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;

  const persona = PERSONAS.find((p) => p.key === key);
  if (persona === undefined) {
    notFound();
  }

  const demo2On = (process.env.RP_ID ?? "").trim() !== "";

  return (
    <SceneShell variant="persona" personaName={persona.display_name}>
      <PersonaIntroForStage
        personaName={persona.display_name}
        introLine={persona.intro_line}
        writtenAsOf={persona.written_as_of}
        opensAt={persona.opens_at}
        questionCount={persona.metrics.length}
      />
      <OpeningFlow
        letterId={persona.letter_id}
        personaName={persona.display_name}
        persona={{
          key: persona.key,
          written_as_of: persona.written_as_of,
          opens_at: persona.opens_at,
        }}
        demo2On={demo2On}
        sampleCandidates={sampleCandidatesFor(persona.key)}
      />
    </SceneShell>
  );
}
