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
import sealedAnswers from "virtual:persona-sealed-answers";
import recollections from "../content/personas/letters/answers.json";

async function main(): Promise<void> {
  // `--hashes` runs before the DATABASE_URL guard and touches no database. It
  // prints each persona's key, letter_id and committed envelope_hash from
  // content/personas/personas.json, then exits 0. It prints no secret, key or
  // PRF material (spec 15, task 3).
  if (process.argv.slice(2).includes("--hashes")) {
    const { PERSONAS } = await import("@/lib/personas");
    for (const persona of PERSONAS) {
      process.stdout.write(
        `seal-personas ${persona.key} ${persona.letter_id} ${persona.envelope_hash}\n`,
      );
    }
    process.exitCode = 0;
    return;
  }

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
    const { results, exitCode, problems } = await sealPersonas({
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
      // Inlined from content/personas/letters/sealed-answers.json by the build;
      // {} when that file is absent, so every persona is sealed as version 1.
      sealedAnswers,
      // Checked before sealing (Requirement 6.8). Never sealed or stored.
      recollections,
      findLetter,
      storePersonaLetter,
      now: () => new Date(),
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    });

    // The text checks ran before any write. Print every problem and stop; no
    // persona line is printed and no row is inserted (Requirement 6.8).
    for (const problem of problems) {
      process.stderr.write(`seal-personas: ${problem}\n`);
    }

    // One fixed line per persona. Nothing else is printed (R8.*).
    for (const result of results) {
      process.stdout.write(`${formatResultLine(result)}\n`);
    }

    // The exit code is 1 when any persona failed or a text check failed, else
    // 0 (R4.14). Set via process.exitCode (not exit()) so the writes flush.
    process.exitCode = exitCode;
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
