import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { formatBackupKey, generateBackupKey } from "@/lib/crypto/backup-key";
import { readKeyFragment, stripFragment } from "./fragment";

// The fragment carries the card key with its hyphens removed (design.md,
// backup key card: QR of `{origin}/l/{letterId}#k={key without hyphens}`).
const fragmentFor = (key: string): string => `#k=${key.replace(/-/g, "")}`;

// The 27-character card key, hyphens removed, as the fragment holds it.
const validKeyText = fc
  .uint8Array({ minLength: 16, maxLength: 16 })
  .map((bytes) => formatBackupKey(bytes).replace(/-/g, ""));

// A path and query the fragment can sit after. Only characters that do not
// need escaping, so the test checks the fragment logic and not URL encoding.
const segment = fc.stringMatching(/^[a-z0-9_-]{1,12}$/);
const pathname = fc.array(segment, { minLength: 1, maxLength: 3 }).map((s) => `/${s.join("/")}`);
const search = fc.option(
  fc.tuple(segment, segment).map(([k, v]) => `?${k}=${v}`),
  { nil: "" },
);

describe("readKeyFragment", () => {
  it("reads back a freshly generated backup key from its card fragment (Property 22)", () => {
    const card = formatBackupKey(generateBackupKey());
    const key = card.replace(/-/g, "");
    expect(readKeyFragment(fragmentFor(card))).toBe(key);
  });

  it("round-trips any backup key through the fragment unchanged (Property 22)", () => {
    fc.assert(
      fc.property(validKeyText, (key) => {
        expect(readKeyFragment(`#k=${key}`)).toBe(key);
      }),
      { numRuns: 200 },
    );
  });

  it("accepts the hash with or without the leading #", () => {
    expect(readKeyFragment("k=ABCD1234")).toBe("ABCD1234");
    expect(readKeyFragment("#k=ABCD1234")).toBe("ABCD1234");
  });

  it("returns null when there is no fragment", () => {
    expect(readKeyFragment("")).toBeNull();
    expect(readKeyFragment("#")).toBeNull();
  });

  it("returns null for other fragment keys", () => {
    expect(readKeyFragment("#x=ABCD")).toBeNull();
    expect(readKeyFragment("#section-2")).toBeNull();
    expect(readKeyFragment("#key=ABCD")).toBeNull();
  });

  it("returns null when the k value is empty", () => {
    expect(readKeyFragment("#k=")).toBeNull();
    expect(readKeyFragment("k=")).toBeNull();
  });

  it("finds k among several fragment parameters", () => {
    expect(readKeyFragment("#a=1&k=ABCD")).toBe("ABCD");
  });
});

describe("stripFragment", () => {
  it("keeps the pathname and search and drops the fragment", () => {
    fc.assert(
      fc.property(pathname, search, validKeyText, (path, query, key) => {
        const calls: Array<[unknown, string, string | URL | null | undefined]> = [];
        const win = {
          location: { pathname: path, search: query, hash: `#k=${key}` },
          history: {
            replaceState: (state: unknown, title: string, url?: string | URL | null) => {
              calls.push([state, title, url]);
            },
          },
        } as unknown as Pick<Window, "history" | "location">;

        stripFragment(win);

        expect(calls).toEqual([[null, "", `${path}${query}`]]);
        expect(String(calls[0][2])).not.toContain("#");
      }),
      { numRuns: 200 },
    );
  });

  it("keeps the path and query of a plain URL", () => {
    const calls: string[] = [];
    const win = {
      location: { pathname: "/l/abc123", search: "?lang=en", hash: "#k=ABCD" },
      history: {
        replaceState: (_s: unknown, _t: string, url?: string | URL | null) => {
          calls.push(String(url));
        },
      },
    } as unknown as Pick<Window, "history" | "location">;

    stripFragment(win);
    expect(calls).toEqual(["/l/abc123?lang=en"]);
  });
});
