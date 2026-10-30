# Design: 01 Skeleton

Follows `tech.md`, `structure.md` and `deploy.md`. This file only records decisions specific to the skeleton.

## Shape

```
Browser ──HTTPS──▶ Ingress (cert-manager, revenant.devclef.se)
                     │
                     ▼
              Service :3000 ──▶ web Deployment (1 replica)
                                  init 1: wait-for-postgres
                                  init 2: migrate (same image)
                                  app:    node server.js (standalone)
                                     │
                                     ▼
                              postgres Service ──▶ postgres StatefulSet + PVC (keep)
```

## Files introduced

| Path | Owner | Purpose |
|---|---|---|
| `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.*`, `vitest.config.ts`, `next.config.ts` | platform-dev | Scaffold, scripts, standalone output, security headers |
| `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` | platform-dev creates a placeholder, frontend-dev styles it | Landing page |
| `src/app/fonts/` | frontend-dev | Self-hosted font files (OFL-licensed serif and sans) |
| `src/app/api/health/route.ts`, `src/app/api/health/ready/route.ts` | platform-dev | Probes |
| `src/lib/db/client.ts`, `drizzle.config.ts`, `drizzle/` | platform-dev | Drizzle client and migrations |
| `scripts/migrate.mjs` | platform-dev | Runs migrations; bundled into the image |
| `src/lib/version.ts` | platform-dev | App version from `package.json`, overridable by `APP_VERSION` env set at image build |
| `Dockerfile`, `.dockerignore` | platform-dev | Image |
| `deploy/helm/revenant/**` | platform-dev | Chart |
| `.github/workflows/*` | bootstrap (not an agent ticket) | CI, policy, image push |

## Decisions

- **Next.js version:** latest stable at scaffold time, pinned exactly in `package.json`.
- **Health:** `/api/health` is static and cheap (liveness must not depend on Postgres, or a database blip restarts the app). `/api/health/ready` runs `SELECT 1` with a 2-second timeout. Both set `Cache-Control: no-store` and `export const dynamic = "force-dynamic"`.
- **CSP:** set in middleware with a per-request nonce, so Next.js inline bootstrapping works without `unsafe-inline` for scripts. Styles may use `'unsafe-inline'` only if Next.js requires it; record the reason in a code comment.
- **Database client:** `postgres` (postgres.js) driver with Drizzle. A single lazily created client; the readiness route is the only skeleton code that uses it.
- **Migrations:** `drizzle-kit generate` produces SQL in `drizzle/`; `scripts/migrate.mjs` uses `drizzle-orm/postgres-js/migrator`. The skeleton ships the Drizzle journal with no tables. Feature specs add the first tables.
- **Image:** `node:<LTS>-alpine` stages: deps → build → runner. The runner copies `.next/standalone`, `.next/static`, `public`, `drizzle/` and `scripts/migrate.mjs` with its runtime deps. Runs as UID 1001. `APP_VERSION` build arg is set to the git SHA by CI.
- **Chart values (defaults):** `host: revenant.devclef.se`, `rpId: revenant.devclef.se`, `appOrigin: https://revenant.devclef.se`, `ingress.className: ""` (cluster default), `ingress.clusterIssuer: letsencrypt-prod`, `postgres.enabled: true`, `postgres.image: postgres:17-alpine`, `postgres.storage.size: 5Gi`, `postgres.storage.className: ""`, `existingSecret: revenant`. Secret keys: `DATABASE_URL`, `POSTGRES_PASSWORD`.
- **Wait for Postgres:** init container using the Postgres image's `pg_isready` against the Service.

## CI gate (written during bootstrap, before any ticket)

`ci.yml` steps run only when the files they need exist (`hashFiles`), so the gate is valid on an empty repo and tightens as tickets land:

| Step | Runs when |
|---|---|
| `npm ci`, `lint`, `typecheck`, `test`, `build` | `package.json` exists |
| `docker build` | `Dockerfile` exists |
| Smoke test: Postgres service container, run migrate in the image, start the image, curl `/`, `/api/health`, `/api/health/ready` | `Dockerfile` exists |
| `helm lint`, `helm template` | `deploy/helm/revenant/Chart.yaml` exists |
| `ci-gate` | always; fails if any step above failed |

`build.yml` pushes to GHCR on `main` and `v*` only after `ci.yml` succeeds for that commit.

## Keeping main deployable

- Each task below leaves `main` passing the CI gate on its own.
- The chart is first released (`v0.1.0` tag) only after tasks 1–8 are merged. Before that tag, nothing is deployed, so partial chart work can't break the live site.
- After the first release, the live site is the chart at the latest tag. Your GitOps repo chooses when to move to a newer tag.

## Testing strategy

- Unit (Vitest): health route handlers, version helper, header configuration.
- Integration (CI smoke test): real image + real Postgres.
- Chart: `helm lint`, `helm template` with defaults, and a check that rendered output contains no `kind: Secret` and that the PVC has the keep annotation.
