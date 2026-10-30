# Requirements: 01 Skeleton

## Goal

A deployable Revenant site at `https://revenant.devclef.se`: a landing page, health checks, a container image on GHCR, and a Helm chart with Postgres and migrations. No letter features. Every merge to `main` leaves the site buildable and deployable.

## Out of scope

Sealing, crypto, figures, data sources, demos, the fetch CronJob, accounts, rate limiting, backups.

## Requirements

### R1. Application scaffold

**User story:** As a developer, I want a standard Next.js project so every agent builds and tests the same way.

1. THE SYSTEM SHALL be a Next.js App Router project in TypeScript strict mode, using npm with a committed `package-lock.json`.
2. THE SYSTEM SHALL provide the npm scripts `lint`, `typecheck`, `test` and `build`, each of which exits non-zero on failure.
3. THE SYSTEM SHALL build with `output: "standalone"`.
4. THE SYSTEM SHALL include `.env.example` listing every environment variable name with no values.
5. THE SYSTEM SHALL NOT list `.kiro/` in `.gitignore`.

### R2. Landing page

**User story:** As a visitor, I want to see what Revenant is, so the deployed site shows something real.

1. WHEN a visitor requests `/` THE SYSTEM SHALL return HTTP 200 with a page showing the name "Revenant" and the tagline "Your past self returns with the receipts."
2. THE landing page SHALL follow `tone.md`: parchment surface, serif headings, no puns or exclamation marks, body text meeting WCAG 2.2 AA contrast.
3. THE landing page SHALL NOT link to any unfinished feature.
4. THE landing page SHALL load no third-party scripts, fonts or analytics. Fonts are self-hosted.

### R3. Health checks

**User story:** As the cluster, I want probes so broken pods are restarted and not sent traffic.

1. WHEN `/api/health` is requested THE SYSTEM SHALL return HTTP 200 with JSON `{"status":"ok","version":"<app version>"}` without contacting the database.
2. WHEN `/api/health/ready` is requested AND the database answers `SELECT 1` THE SYSTEM SHALL return HTTP 200 with `{"status":"ready"}`.
3. WHEN `/api/health/ready` is requested AND the database does not answer within 2 seconds THE SYSTEM SHALL return HTTP 503 with `{"status":"unavailable"}` and no error details.
4. THE health routes SHALL NOT read or write any letter data.

### R4. Security headers

**User story:** As a user, I want the site locked down from the start, so later crypto pages inherit safe defaults.

1. THE SYSTEM SHALL send on every response: a Content-Security-Policy allowing scripts, styles, fonts, images and connections only from `'self'` (Next.js inline needs handled with a nonce or hash, never `unsafe-eval`), `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and `Permissions-Policy` disabling camera, microphone and geolocation.
2. WHEN served over HTTPS THE SYSTEM SHALL send `Strict-Transport-Security: max-age=31536000`.

### R5. Container image

**User story:** As the operator, I want one small image I can trust.

1. THE SYSTEM SHALL build one multi-stage image that runs the web server as a non-root user.
2. THE same image SHALL run database migrations with `node scripts/migrate.mjs` (or an equivalent single command).
3. WHEN CI runs on `main` THE SYSTEM SHALL push the image to `ghcr.io/devclef/revenant` tagged with the full commit SHA, and on `v*` tags also with the version.

### R6. Database and migrations

**User story:** As a developer, I want migrations in place so feature specs only add tables.

1. THE SYSTEM SHALL use Drizzle ORM with SQL migrations in `drizzle/`.
2. WHEN the migrate command runs against an empty Postgres THE SYSTEM SHALL succeed and record applied migrations.
3. WHEN the migrate command runs a second time THE SYSTEM SHALL apply nothing and succeed.
4. THE SYSTEM SHALL read the connection string only from `DATABASE_URL` and SHALL NOT log it.

### R7. Helm chart

**User story:** As the operator, I want a chart my Fleet repo can deploy without forking it.

1. THE chart at `deploy/helm/revenant` SHALL deploy the web app, a Service, an Ingress with TLS, a ConfigMap and, enabled by default, a single-replica Postgres StatefulSet with a PVC.
2. THE PVC SHALL carry `helm.sh/resource-policy: keep`.
3. THE web pod SHALL wait for Postgres and run migrations in init containers before the app container starts.
4. THE chart SHALL read all secrets from an existing Secret named by `existingSecret` and SHALL NOT render secret values.
5. THE image repository and tag, host, ingress class, cert-manager issuer, storage class, resources and `existingSecret` SHALL be values. The default host and `RP_ID` SHALL be `revenant.devclef.se`.
6. THE web Deployment SHALL use `/api/health` for liveness and `/api/health/ready` for readiness.
7. `helm lint` and `helm template` SHALL pass with default values.

### R8. Always deployable

**User story:** As the owner, I want the site to stay up while agents work.

1. WHEN a pull request targets `main` THE CI gate SHALL run every check that applies to files present in the repository, and SHALL block merging on any failure.
2. WHEN a Dockerfile exists THE CI gate SHALL build the image, start it with a Postgres service container, run migrations, and require HTTP 200 from `/`, `/api/health` and `/api/health/ready`.
