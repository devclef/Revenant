**Spec:** [.kiro/specs/01-skeleton/tasks.md](https://github.com/devclef/Revenant/blob/main/.kiro/specs/01-skeleton/tasks.md) · Task 1 · Requirements: R1.1–R1.5, R2.1, R2.3
**Agent:** platform-dev
**Depends on:** none

## Context

First ticket and the pilot for the agent loop. It creates the Next.js app the rest of the project builds on, with a plain placeholder landing page. Styling comes later in task 9.

## Scope

Paths this task may change:

- `package.json`, `package-lock.json`
- `tsconfig.json`, `next-env.d.ts`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- `src/lib/version.ts` and its test
- `.env.example`, `.gitignore`

## Out of scope

- Health routes, middleware, CSP, Dockerfile, database, Helm chart (later tasks).
- Styling, fonts, images.

## Acceptance criteria

- [ ] Next.js App Router project in TypeScript strict mode, latest stable Next.js pinned exactly, npm with a committed `package-lock.json`.
- [ ] npm scripts `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`) and `build` exist and each fails on error.
- [ ] `next.config.ts` sets `output: "standalone"`.
- [ ] `/` renders "Revenant" and "Your past self returns with the receipts." as plain text, with no links.
- [ ] `src/lib/version.ts` exports the app version (from `APP_VERSION` if set, otherwise `package.json`), with a Vitest test.
- [ ] `.env.example` exists. `.gitignore` covers `node_modules`, `.next`, `.env*` except `.env.example`, and does **not** exclude `.kiro/`.

## Validation

```bash
bash scripts/check.sh
```
