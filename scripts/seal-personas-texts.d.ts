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
