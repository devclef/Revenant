# Self-hosted fonts

These fonts are bundled with Revenant and served from the app's own origin only.
Nothing here is fetched from Google Fonts, a CDN, or any remote host, so the
strict `font-src 'self'` Content Security Policy is satisfied (see `tech.md`).

Both faces are variable fonts: a single `woff2` covers the full weight range,
which keeps the dependency footprint small.

| File | Font | Role | License | Copyright |
|---|---|---|---|---|
| `EBGaramond-Variable.woff2` | EB Garamond (variable, `wght`) | Serif display face for headings, the wordmark and letter text | SIL Open Font License 1.1 (`EBGaramond-OFL.txt`) | 2017 The EB Garamond Project Authors |
| `Inter-Variable.woff2` | Inter (variable, `opsz`, `wght`) | Clean, readable sans for UI chrome and data/numbers | SIL Open Font License 1.1 (`Inter-OFL.txt`) | 2020 The Inter Project Authors |

## Licensing

Both fonts are licensed under the SIL Open Font License, Version 1.1, which
permits self-hosting, bundling and redistribution with the software. The full
license text for each font is kept beside it:

- `EBGaramond-OFL.txt` — https://github.com/octaviopardo/EBGaramond12
- `Inter-OFL.txt` — https://github.com/rsms/inter

The OFL requires that the font files are distributed with their license and
that the reserved font names are not used for modified versions. These files
are the unmodified upstream fonts, converted from the published TTF to WOFF2
for the web with no glyph or metadata changes.

## Wiring

These files are loaded in `src/app/layout.tsx` via `next/font/local` (a build-time
local import, no network request). Do not reference them from a remote URL.
