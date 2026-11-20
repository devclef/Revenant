// Bundles the persona-sealing script into dist/seal-personas.mjs with esbuild
// (design.md "Bundling", R4.13). Run by `npm run build` (after `next build`)
// and directly in CI/validation. The result is one self-contained ESM file that
// runs in the migrate init container with no node_modules present: postgres,
// drizzle-orm and zod are bundled in.
//
// The letter-text virtual module. `virtual:persona-letter-texts` is resolved by
// the plugin below: it reads content/personas/personas.json, checks each
// letter_path against the same pattern the persona schema uses, reads each
// letter file under content/personas/ and emits a default export mapping
// letter_path to text. Adding a persona needs no change here.
//
// Self-contained check. With metafile: true, after the build the script fails
// if any import left in the output is not a Node built-in, so "one file, no
// node_modules" is a checked fact rather than a hope.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { isBuiltin } from "node:module";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(root, "scripts/seal-personas.ts");

// The virtual module specifier and the letter_path pattern, kept in step with
// the persona schema's letterPathSchema (letters/<name>.txt, no path escape).
const VIRTUAL_ID = "virtual:persona-letter-texts";
const LETTER_PATH_RE = /^letters\/[a-z0-9-]+\.txt$/;

/**
 * esbuild plugin that inlines the persona letter texts as the default export of
 * `virtual:persona-letter-texts`. It reads the committed persona list, and for
 * each persona reads its letter file (validating letter_path first), building a
 * map from letter_path to text. The emitted module is pure data; it touches no
 * database and carries no secret.
 */
const letterTextsPlugin = {
  name: "persona-letter-texts",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^virtual:persona-letter-texts$/ }, () => ({
      path: VIRTUAL_ID,
      namespace: "persona-letter-texts",
    }));

    pluginBuild.onLoad(
      { filter: /.*/, namespace: "persona-letter-texts" },
      () => {
        const personasDir = resolve(root, "content/personas");
        const list = JSON.parse(
          readFileSync(resolve(personasDir, "personas.json"), "utf8"),
        );

        const texts = {};
        for (const persona of list.personas) {
          const letterPath = persona.letter_path;
          if (
            typeof letterPath !== "string" ||
            !LETTER_PATH_RE.test(letterPath)
          ) {
            throw new Error(
              `seal-personas.build: invalid letter_path ${JSON.stringify(
                letterPath,
              )}`,
            );
          }
          texts[letterPath] = readFileSync(
            resolve(personasDir, letterPath),
            "utf8",
          );
        }

        return {
          contents: `export default ${JSON.stringify(texts)};`,
          loader: "js",
          // Watch mode re-reads these on change; harmless for a one-shot build.
          watchFiles: [resolve(personasDir, "personas.json")],
        };
      },
    );
  },
};

// The sealed-answers virtual module. `virtual:persona-sealed-answers` is the
// committed content/personas/letters/sealed-answers.json, inlined as the default
// export: a map from persona key to that persona's sealed answers, one per
// author question. When the file is absent the module exports {} so every
// persona stays on format version 1 and the build still succeeds.
const SEALED_ANSWERS_ID = "virtual:persona-sealed-answers";
const sealedAnswersFile = resolve(
  root,
  "content/personas/letters/sealed-answers.json",
);

const sealedAnswersPlugin = {
  name: "persona-sealed-answers",
  setup(pluginBuild) {
    pluginBuild.onResolve(
      { filter: /^virtual:persona-sealed-answers$/ },
      () => ({
        path: SEALED_ANSWERS_ID,
        namespace: "persona-sealed-answers",
      }),
    );

    pluginBuild.onLoad(
      { filter: /.*/, namespace: "persona-sealed-answers" },
      () => {
        const present = existsSync(sealedAnswersFile);
        const answers = present
          ? JSON.parse(readFileSync(sealedAnswersFile, "utf8"))
          : {};
        if (
          typeof answers !== "object" ||
          answers === null ||
          Array.isArray(answers) ||
          !Object.values(answers).every(
            (list) =>
              Array.isArray(list) &&
              list.every((item) => typeof item === "string"),
          )
        ) {
          throw new Error(
            "seal-personas.build: sealed-answers.json must map persona keys to arrays of strings",
          );
        }
        return {
          contents: `export default ${JSON.stringify(answers)};`,
          loader: "js",
          watchFiles: present ? [sealedAnswersFile] : [],
        };
      },
    );
  },
};

const result = await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: resolve(root, "dist/seal-personas.mjs"),
  sourcemap: false,
  legalComments: "none",
  metafile: true,
  // Define require under ESM so any CommonJS dependency bundled in still works.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  plugins: [letterTextsPlugin, sealedAnswersPlugin],
});

// Fail if the bundle still imports anything that is not a Node built-in, so the
// output really is a single self-contained file (design.md "Bundling").
const outputs = result.metafile?.outputs ?? {};
const offenders = new Set();
for (const output of Object.values(outputs)) {
  for (const imported of output.imports ?? []) {
    const name = imported.path;
    const builtin =
      name.startsWith("node:") || isBuiltin(name.replace(/^node:/, ""));
    if (!builtin) {
      offenders.add(name);
    }
  }
}

if (offenders.size > 0) {
  console.error(
    `seal-personas.build: bundle has non-built-in imports: ${[...offenders]
      .sort()
      .join(", ")}`,
  );
  process.exit(1);
}

console.log("seal-personas.build: wrote dist/seal-personas.mjs");
