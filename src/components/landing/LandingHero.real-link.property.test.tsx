// Property 7: the two calls to action are kept, and the real seal link shows
// only while realSealing is on (spec 09 landing hero, Requirement B1).
//
// For any persona count, any Demo_2_On and any realSealing value:
//   - the primary call to action is present exactly when there is at least
//     one persona, and the secondary call to action exactly when Demo_2_On is
//     on. Turning realSealing on or off never adds or removes either one.
//   - the real seal link (data-real-seal) is present exactly when realSealing
//     is on, and it links to /seal.

import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { LandingHero } from "./LandingHero";
import { LANDING_COPY } from "./copy";

const arbPersonaCount = fc.integer({ min: 0, max: 5 });

function render(
  personaCount: number,
  demo2On: boolean,
  realSealing: boolean,
): string {
  return renderToStaticMarkup(
    <LandingHero
      personaCount={personaCount}
      demo2On={demo2On}
      realSealing={realSealing}
    />,
  );
}

describe("Property 7: LandingHero keeps both calls to action and gates the real seal link", () => {
  it("keeps the calls to action as configured, whatever realSealing is", () => {
    fc.assert(
      fc.property(
        arbPersonaCount,
        fc.boolean(),
        fc.boolean(),
        (personaCount, demo2On, realSealing) => {
          const html = render(personaCount, demo2On, realSealing);
          expect(html.includes('data-cta="primary"')).toBe(personaCount >= 1);
          expect(html.includes('data-cta="secondary"')).toBe(demo2On);
          if (personaCount >= 1) {
            expect(html).toContain('href="/demo"');
          }
          if (demo2On) {
            expect(html).toContain('href="/demo/live"');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("shows the real seal link to /seal exactly while realSealing is on", () => {
    fc.assert(
      fc.property(
        arbPersonaCount,
        fc.boolean(),
        fc.boolean(),
        (personaCount, demo2On, realSealing) => {
          const html = render(personaCount, demo2On, realSealing);
          expect(html.includes("data-real-seal")).toBe(realSealing);
          if (realSealing) {
            expect(html).toContain('href="/seal"');
            expect(html).toContain(LANDING_COPY.realSealLink);
          } else {
            expect(html).not.toContain('href="/seal"');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("leaves the call-to-action markup identical with realSealing on or off", () => {
    fc.assert(
      fc.property(arbPersonaCount, fc.boolean(), (personaCount, demo2On) => {
        const off = render(personaCount, demo2On, false);
        const on = render(personaCount, demo2On, true);
        const actionsOf = (html: string) =>
          html.match(/<div [^>]*data-block="actions"[\s\S]*?<\/div>/)?.[0] ??
          "";
        expect(actionsOf(on)).toBe(actionsOf(off));
        expect(actionsOf(on)).not.toBe("");
      }),
      { numRuns: 100 },
    );
  });
});
