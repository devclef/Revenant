import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui";
import { DemoLabel } from "@/components/demo/DemoLabel";
import { OpeningFlow } from "@/components/reveal/OpeningFlow";
import { PERSONAS } from "@/lib/personas";

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

  return (
    <PageShell>
      <DemoLabel />
      <OpeningFlow
        letterId={persona.letter_id}
        personaName={persona.display_name}
      />
    </PageShell>
  );
}
