// The type of the browser crypto barrel (spec 06, design.md "Components and
// Interfaces", crypto-module.ts).
//
// This is the only type-level reference to "@/lib/crypto" in the live demo. It
// is written as `typeof import(...)`, not `import type`, because the reveal and
// live import-boundary tests allow only a dynamic `import()` of the crypto
// barrel from src/components. Files that need the type import it from here.
//
// The file has no runtime code, so nothing is bundled from the crypto library.

export type CryptoModule = typeof import("@/lib/crypto");
