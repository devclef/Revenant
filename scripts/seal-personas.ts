// Sealing_Script entry (design.md "Sealing_Script", R4.12, R4.13, R8.*).
//
// This is the bundle entry: it wires the real I/O dependencies and hands them
// to the pure `sealPersonas` in seal-personas-core.ts. It prints exactly one
// `formatResultLine` per persona and nothing else — no server secret, DEK,
// ciphertext, letter text or DATABASE_URL ever reaches stdout or stderr (R8.*).
//
// DATABASE_URL guard first. Before importing ANYTHING that can open a database
// connection (getSql, the letter-store), the entry checks DATABASE_URL. If it
// is unset or empty it writes one fixed line to stderr and exits 1, so running
// the script without a database fails cleanly instead of throwing a driver
// error that could mention the connection string (R4.12, R8.6). The connecting
// modules are pulled in with dynamic `import()` only after the guard passes, so
// they are never evaluated when DATABASE_URL is missing.
//
// The letter texts are a static top-level import: `virtual:persona-letter-texts`
// is a build-time virtual module, inlined by the esbuild plugin in
// scripts/seal-personas.build.mjs. It holds only the persona letter texts (pure
// data, no database, no connection), so importing it at module top is safe
// relative to the DATABASE_URL guard, and a static import is what the bundler's
// resolver plugin intercepts — a dynamic import of the virtual path does not
// resolve at bundle time.
//
// Import boundary: the dynamically imported modules include `@/lib/crypto`
// (through seal-personas-core.ts), which the crypto.md R14.6 exemption allows
// for the sealing script. Nothing under `src/` imports `scripts/`.

import letterTexts from "virtual:persona-letter-texts";

async function main(): Promise<void> {
  // The guard runs before any connecting import. A missing or empty
  // DATABASE_URL is reported with one fixed line and exit code 1; the value
  // itself is never printed (R4.12, R8.6).
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    process.stderr.write("seal-personas: DATABASE_URL is not set\n");
    process.exit(1);
  }

  // Only now, past the guard, pull in the modules that connect or that reach
  // crypto. Dynamic imports keep them out of the evaluated graph until here.
  const { PERSONAS } = await import("@/lib/personas");
  const { DEMO_FIGURES } = await import("@/lib/figures/demo");
  const { findLetter } = await import("@/lib/letter-store/queries");
  const { storePersonaLetter } = await import("@/lib/letter-store/store");
  const { getSql } = await import("@/lib/db/client");
  const { sealPersonas, formatResultLine } = await import(
    "./seal-personas-core"
  );

  try {
    const { results } = await sealPersonas({
      personas: PERSONAS,
      // The letter texts are inlined into the bundle as a map from letter_path
      // to text (virtual:persona-letter-texts); no filesystem read at run time.
      readLetterText: (path) => {
        const text = letterTexts[path];
        if (text === undefined) {
          throw new Error(`seal-personas: no bundled text for ${path}`);
        }
        return text;
      },
      figures: DEMO_FIGURES,
      findLetter,
      storePersonaLetter,
      now: () => new Date(),
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    });

    // One fixed line per persona. Nothing else is printed (R8.*).
    for (const result of results) {
      process.stdout.write(`${formatResultLine(result)}\n`);
    }

    // The exit code is 1 when any persona failed, else 0 (R4.14). Set via
    // process.exitCode (not exit()) so the stream writes above flush.
    process.exitCode = results.some((r) => r.result === "failed") ? 1 : 0;
  } finally {
    // Always close the client so the process can exit cleanly, even on a throw.
    await getSql().end({ timeout: 5 });
  }
}

main().catch(() => {
  // Any unexpected throw that escapes `main` (for example a failed dynamic
  // import) fails the run without echoing the error, which could carry a stored
  // value or the connection string (R8.6).
  process.stderr.write("seal-personas: unexpected error\n");
  process.exitCode = 1;
});
