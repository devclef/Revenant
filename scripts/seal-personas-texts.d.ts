// Virtual module produced by the esbuild bundle (scripts/seal-personas.build.mjs).
// At build time the persona letter texts in content/personas/ are inlined and
// exposed here as a map from letter_path to the letter text, so the bundled
// seal-personas script carries its texts and does not read the filesystem at
// run time. This declaration lets seal-personas-core.ts and seal-personas.ts
// import the module with types.
declare module "virtual:persona-letter-texts" {
  const texts: Record<string, string>;
  export default texts;
}

// Virtual module produced by the esbuild bundle (scripts/seal-personas.build.mjs).
// The committed content/personas/letters/sealed-answers.json is inlined here as a
// map from persona key to that persona's answers, one per author question, in
// the same order as the author questions. A persona with no entry is sealed as
// format version 1.
declare module "virtual:persona-sealed-answers" {
  const answers: Record<string, string[]>;
  export default answers;
}
