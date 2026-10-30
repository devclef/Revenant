# Tasks: 01 Skeleton

Each task is one GitHub issue, worked by one agent, and leaves `main` passing the CI gate. Validation always includes the CI gate; commands below are what the agent must run locally first.

- [ ] 1. Scaffold the Next.js app with a placeholder landing page **(pilot ticket)**
  - Agent: `platform-dev` · Depends on: none
  - Scope: root config files, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/lib/version.ts`, `.env.example`, `.gitignore`
  - Acceptance:
    - `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` all pass; at least one Vitest test exists (for `src/lib/version.ts`).
    - `next.config.ts` sets `output: "standalone"`.
    - `/` renders "Revenant" and "Your past self returns with the receipts." as plain, unstyled text.
    - `.gitignore` does not exclude `.kiro/`. `.env.example` exists (empty list is fine).
  - Validation: `npm ci && npm run lint && npm run typecheck && npm test && npm run build`
  - _Requirements: R1.1–R1.5, R2.1, R2.3_

- [ ] 2. Add the liveness route `/api/health`
  - Agent: `platform-dev` · Depends on: 1
  - Scope: `src/app/api/health/route.ts` and its test
  - Acceptance: returns 200 `{"status":"ok","version":...}` with `Cache-Control: no-store`; no database import; unit test covers the response.
  - Validation: `npm test && npm run build`
  - _Requirements: R3.1, R3.4_

- [ ] 3. Add security headers and CSP with nonce
  - Agent: `platform-dev` · Depends on: 1
  - Scope: `src/middleware.ts`, `next.config.ts`, tests
  - Acceptance: every header in R4.1 is present on `/` and `/api/health`; CSP has no `unsafe-eval` and uses a nonce for scripts; HSTS is sent; the page still renders with no CSP console errors in `next start`.
  - Validation: `npm test && npm run build`, plus a test that asserts header values
  - _Requirements: R4.1, R4.2_

- [ ] 4. Add the Dockerfile
  - Agent: `platform-dev` · Depends on: 2
  - Scope: `Dockerfile`, `.dockerignore`
  - Acceptance: multi-stage, non-root (UID 1001), `APP_VERSION` build arg; `docker run` serves `/` and `/api/health` with 200; image under 250 MB. The CI smoke test's migrate and readiness checks are allowed to be skipped until task 6 (the CI step treats a missing `scripts/migrate.mjs` as skip).
  - Validation: `docker build -t revenant:test . && docker run --rm -p 3000:3000 revenant:test` then curl both routes
  - _Requirements: R5.1, R8.2_

- [ ] 5. Add the Drizzle client and migrate script
  - Agent: `platform-dev` · Depends on: 1
  - Scope: `src/lib/db/client.ts`, `drizzle.config.ts`, `drizzle/`, `scripts/migrate.mjs`, `package.json` scripts `db:generate`, `db:migrate`, `.env.example` (`DATABASE_URL`)
  - Acceptance: migrate succeeds against an empty Postgres and again on a second run; `DATABASE_URL` is never logged; no tables are created yet.
  - Validation: `docker run -d -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:17-alpine`, then `DATABASE_URL=postgres://postgres:test@localhost:5432/postgres npm run db:migrate` twice
  - _Requirements: R6.1–R6.4_

- [ ] 6. Add the readiness route and include migrations in the image
  - Agent: `platform-dev` · Depends on: 4, 5
  - Scope: `src/app/api/health/ready/route.ts` and test, `Dockerfile` (copy `drizzle/` and migrate script)
  - Acceptance: 200 when Postgres answers, 503 `{"status":"unavailable"}` within ~2 s when it doesn't, no error details leaked; the image runs `node scripts/migrate.mjs`; the full CI smoke test (migrate + `/`, `/api/health`, `/api/health/ready`) passes.
  - Validation: CI smoke test
  - _Requirements: R3.2–R3.4, R5.2, R8.2_

- [ ] 7. Add the Helm chart: web app, Service, Ingress, ConfigMap
  - Agent: `platform-dev` · Depends on: 6
  - Scope: `deploy/helm/revenant/` (`Chart.yaml`, `values.yaml`, `.helmignore`, `templates/deployment.yaml`, `service.yaml`, `ingress.yaml`, `configmap.yaml`, `_helpers.tpl`, `NOTES.txt`), chart `README.md`
  - Acceptance: values as listed in design.md; liveness `/api/health`, readiness `/api/health/ready`; secrets only via `existingSecret`; non-root security context; `helm lint` and `helm template` pass; rendered output contains no `kind: Secret`.
  - Validation: `helm lint deploy/helm/revenant && helm template t deploy/helm/revenant`
  - _Requirements: R7.1, R7.4–R7.7_

- [ ] 8. Add Postgres and migration init containers to the chart
  - Agent: `platform-dev` · Depends on: 7
  - Scope: `templates/postgres-statefulset.yaml`, `templates/postgres-service.yaml`, `templates/deployment.yaml` (init containers), `values.yaml`, chart `README.md`, chart version bump
  - Acceptance: Postgres enabled by default, single replica, pinned image, PVC with `helm.sh/resource-policy: keep` and configurable storage class; init containers wait with `pg_isready` and then run migrate; Postgres is not exposed via the ingress; README lists the Secret keys (`DATABASE_URL`, `POSTGRES_PASSWORD`).
  - Validation: `helm lint`, `helm template`, and a check that the rendered PVC has the keep annotation
  - _Requirements: R7.1–R7.3_

- [ ] 9. Style the landing page in Revenant's voice
  - Agent: `frontend-dev` · Depends on: 3
  - Scope: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/fonts/`, `src/components/ui/**`
  - Acceptance: follows `tone.md` (parchment, ink, wax-seal red, serif headings); self-hosted fonts only; a short description of Revenant in plain words; no links to unfinished features; passes WCAG 2.2 AA contrast for text; respects `prefers-reduced-motion`; no CSP violations.
  - Validation: `npm run lint && npm run build`, plus a contrast check recorded in the PR description
  - _Requirements: R2.1–R2.4_

- [ ] 10. Prepare the first release
  - Agent: `platform-dev` · Depends on: 8, 9
  - Scope: `deploy/helm/revenant/Chart.yaml` (`version: 0.1.0`, `appVersion: 0.1.0`), `package.json` version, chart `README.md` install notes
  - Acceptance: versions aligned at `0.1.0`; README explains the Secret to create and the values a GitOps repo usually overrides. After merge, the owner tags `v0.1.0`, which pushes `ghcr.io/devclef/revenant:0.1.0`.
  - Validation: CI gate
  - _Requirements: R5.3, R7.5_
