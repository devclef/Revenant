---
inclusion: fileMatch
fileMatchPattern: ["deploy/**", ".github/workflows/**", "Dockerfile", ".dockerignore", "next.config.*", ".env.example", "drizzle/**", "scripts/**"]
---

# Deployment: Docker, Helm and CI

Revenant runs on the user's self-hosted, internet-facing cluster: an RKE2 guest cluster provisioned by Rancher on Harvester. The user deploys it with Fleet from their own GitOps repository. This repository provides only two things: the Helm chart and the container image. No Fleet configuration lives here. The always-loaded rule in `tech.md` requires the chart to stay in sync with the app.

## Image

- One multi-stage `Dockerfile` producing a small image from Next.js `output: "standalone"`.
- Runs as a non-root user with a read-only root filesystem where possible.
- The same image runs three things: the web server, database migrations, and the daily fetch script.
- Published to `ghcr.io/devclef/revenant`.
- Tags: the full git commit SHA on every push to `main`, and the version (for example `0.3.0`) on git tags `v*`. The chart's default `image.tag` is its `appVersion`. Never rely on `latest`.

## CI (GitHub Actions)

`.github/workflows/build.yml`:

- On pull requests: lint, type-check, build the image without pushing, and run `helm lint` and `helm template` on the chart.
- On push to `main` and on `v*` tags: build and push the image to GHCR, using the built-in `GITHUB_TOKEN` with `packages: write`. No personal access tokens.
- Pin third-party actions to a full commit SHA.
- Build for `linux/amd64` (add `arm64` only if the cluster needs it).
- The workflow never deploys to the cluster. Deployment is the GitOps repository's job.

## Chart layout

```
deploy/helm/revenant/
├── Chart.yaml           # version bumped on every chart change; appVersion = app version
├── values.yaml          # every setting documented, no secrets, sensible defaults for this cluster
├── .helmignore
└── templates/
    ├── deployment.yaml      # web app; init containers wait for Postgres, then run migrations
    ├── service.yaml
    ├── ingress.yaml         # host revenant.devclef.se, TLS via cert-manager
    ├── fetch-cronjob.yaml   # daily figure fetch, concurrencyPolicy: Forbid
    ├── configmap.yaml       # RP_ID, APP_ORIGIN and other non-secret config
    ├── postgres-statefulset.yaml
    ├── postgres-service.yaml
    └── NOTES.txt
```

## Rules

### Secrets

- All secrets (Postgres password, `DATABASE_URL`, source API keys) come from an existing Kubernetes Secret named in `values.yaml` (`existingSecret`). The chart never renders secret values, and no secret ever goes into this repository. `NOTES.txt` and the chart README list the keys the Secret must contain.

### Postgres (included in the chart)

- Postgres is part of the chart and enabled by default: a single-replica StatefulSet using the official `postgres` image at a pinned major version.
- Data lives on a PersistentVolumeClaim. `storageClassName` is configurable and defaults to the cluster default (the Harvester CSI storage class on this cluster).
- Sealed letters live in this database, so the PVC carries `helm.sh/resource-policy: keep` and must survive `helm uninstall`, Fleet bundle deletion and chart upgrades. Never template the PVC in a way that a rename recreates it empty.
- The app connects through the in-cluster Service. Postgres is never exposed through the ingress.
- No backup job in the chart for now. Don't add one unless asked.

### Migrations

- Migrations run in an init container of the web Deployment, after a second init container has waited for Postgres to accept connections. This works on first install (when Postgres doesn't exist yet) and doesn't depend on Helm hooks, which fit poorly with Fleet.
- The web Deployment runs one replica in the MVP, so migrations never run concurrently. Moving to more replicas requires moving migrations to a separate Job first.
- Migrations only add. Never drop or rewrite sealed tables or their immutability triggers.

### Fetch job

- A CronJob runs the fetch script directly against the database. It has no HTTP endpoint and needs no shared secret.

### Ingress and HTTPS

- `ingressClassName` and the cert-manager `cluster-issuer` annotation are values, not hardcoded. The user's Let's Encrypt setup issues the certificate for `revenant.devclef.se`.
- Passkeys only work on a secure origin matching `RP_ID`, so TLS is required and the ingress host must equal `RP_ID`.
- The chart adds no authentication annotations. Letter links, the demo pages and the static assets must be publicly reachable, so the app must not be placed behind Authentik forward-auth or another SSO proxy.

### GitOps boundary

- Fleet configuration (`fleet.yaml`, `GitRepo`, per-cluster values) lives in the user's GitOps repository, not here. Don't add it.
- Everything a deployer might need to change (image repository and tag, host, ingress class, issuer, storage class, resources, existing Secret name) must be a value in `values.yaml`, so the GitOps repo can override it without forking the chart.
- Every new or changed value is documented in `values.yaml` and the chart README, and the chart `version` is bumped.

### Other

- **Health:** the app exposes `/api/health` for liveness and readiness probes. It must not touch letter data.
- **Logging:** request logs must not include request bodies of sealing or opening routes, or any key material. Don't add client-side logging that could capture URL fragments.
- `helm lint` and `helm template` must pass before any change to the chart is considered done. CI runs both.
