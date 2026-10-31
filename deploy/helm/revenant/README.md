# Revenant Helm chart

Deploys Revenant — seal a letter to your future self, opened with the receipts —
to a Kubernetes cluster. One container image serves the web app, runs the
database migrations (as an init container of the web pod) and runs the daily
fetch job. A PostgreSQL StatefulSet is bundled by default; sealed letters live
there.

This chart is part of the product and is kept in sync with the app. Any change
that adds or renames an environment variable, secret, port, probe, migration
step or job updates `values.yaml`, this README and `.env.example`, and bumps the
chart `version`. See `.kiro/steering/deploy.md`.

## Secrets

The chart renders **no `Secret`**. Every sensitive value is read from an
existing Kubernetes Secret named by `existingSecret` (default `revenant`), which
you create out of band before installing. It must hold at least:

| Key | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string the app and migrations use. |
| `POSTGRES_PASSWORD` | Password for the bundled PostgreSQL. |

Source API keys (for example `BLS_API_KEY`, `EIA_API_KEY`) are added to the same
Secret as the daily fetch job needs them.

**Create this Secret before you install the chart.** The chart does not create
it. If the Secret named by `existingSecret` is missing, the web pod will not
start. See [Install](#install) for the `kubectl create secret` command.

## Health

- Liveness probe: `GET /api/health`
- Readiness probe: `GET /api/health/ready`

## PostgreSQL

When `postgres.enabled` is `true` (the default), the chart deploys a bundled
PostgreSQL as a single-replica StatefulSet. Its PersistentVolumeClaim carries
`helm.sh/resource-policy: keep`, so the volume — and the sealed letters on it —
survives a `helm uninstall`. Postgres is reached only in-cluster through the
`postgres.service.name` Service and is never exposed via the Ingress. Set
`postgres.enabled: false` to use an external database instead; the app then
reads `DATABASE_URL` from the Secret as usual.

## Install

Create the Secret first, then install:

```bash
kubectl create secret generic revenant \
  --from-literal=DATABASE_URL='postgres://...' \
  --from-literal=POSTGRES_PASSWORD='...'

helm install revenant deploy/helm/revenant \
  --set host=revenant.devclef.se \
  --set rpId=revenant.devclef.se \
  --set appOrigin=https://revenant.devclef.se
```

Passkeys are bound to `rpId`, so `host`, `rpId` and the host of `appOrigin` must
all match and the site must be served over HTTPS.

Validate the chart without installing:

```bash
helm lint deploy/helm/revenant
helm template t deploy/helm/revenant
```

## Values

| Value | Default | Meaning |
|---|---|---|
| `replicaCount` | `1` | Web Deployment replicas. Keep at 1 in the MVP: migrations run in an init container of the web pod, so more than one replica would run them concurrently. |
| `image.repository` | `ghcr.io/devclef/revenant` | Container image repository. One image serves web, migrations and the fetch job. |
| `image.tag` | `""` | Image tag. Empty falls back to the chart `appVersion`. Use a full git SHA or a `v*` version in production; never rely on `latest`. |
| `image.pullPolicy` | `IfNotPresent` | Image pull policy. Use `Always` only with the moving `dev` tag. |
| `service.type` | `ClusterIP` | Service type. The app is reached through the Ingress. |
| `service.port` | `3000` | Service port. The web container listens on 3000 (Next.js standalone). |
| `host` | `revenant.devclef.se` | Public hostname served by the Ingress. MUST equal `rpId`. |
| `rpId` | `revenant.devclef.se` | WebAuthn Relying Party ID. Passkeys are bound to this domain; must match `host` and the registrable domain of `appOrigin`. |
| `appOrigin` | `https://revenant.devclef.se` | Full origin (scheme + host) the app runs on. Must be https and match `host`. |
| `ingress.enabled` | `true` | Create an Ingress for the web Service. |
| `ingress.className` | `""` | IngressController class name. Empty uses the cluster's default class. |
| `ingress.clusterIssuer` | `letsencrypt-prod` | cert-manager ClusterIssuer that issues the TLS certificate for `host`. |
| `existingSecret` | `revenant` | Name of an existing Secret holding all sensitive values (see [Secrets](#secrets)). The chart never renders secret values. |
| `postgres.enabled` | `true` | Deploy the bundled PostgreSQL StatefulSet. Sealed letters live here. |
| `postgres.image` | `postgres:17-alpine` | Postgres image, pinned to a major version. Also provides `pg_isready` for the wait-for-postgres init container. |
| `postgres.service.name` | `postgres` | In-cluster Service name the app connects through. Never exposed via Ingress. |
| `postgres.service.port` | `5432` | Postgres Service port. |
| `postgres.storage.size` | `5Gi` | PersistentVolumeClaim size for Postgres data. |
| `postgres.storage.className` | `""` | StorageClass for the PVC. Empty uses the cluster default. |
| `podSecurityContext` | `runAsNonRoot: true`, `runAsUser/Group/fsGroup: 1001` | Pod-level security context. Runs the whole pod as a non-root user. |
| `securityContext` | non-root, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, all capabilities dropped | Container-level security context for the web app. |
| `resources` | `{}` | CPU/memory requests and limits for the web container. Set per environment. |
| `nodeSelector` | `{}` | Node selector for scheduling the web pod. |
| `tolerations` | `[]` | Tolerations for the web pod. |
| `affinity` | `{}` | Affinity rules for the web pod. |

## Release / GitOps overrides

The MVP is deployed with Fleet from a separate GitOps repository (see
`.kiro/steering/deploy.md`). That repo keeps its own values and usually
overrides:

| Value | Why a GitOps repo overrides it |
|---|---|
| `image.repository` | Point at the published image, `ghcr.io/devclef/revenant`. |
| `image.tag` | Pin to a released `v*` tag or a full git SHA, never `latest`. |
| `host` | The public hostname for the target cluster. |
| `rpId` | WebAuthn Relying Party ID; must equal `host`. |
| `appOrigin` | Full origin the app runs on; must be https and match `host`. |
| `ingress.className` | The cluster's IngressController class. |
| `ingress.clusterIssuer` | The cert-manager ClusterIssuer for TLS on `host`. |
| `postgres.storage.className` | The StorageClass for the Postgres PVC. |
| `resources` | CPU/memory requests and limits per environment. |
| `existingSecret` | Name of the pre-created Secret holding sensitive values. |

After this change is merged, the owner tags `v0.1.0`. That tag publishes the
image `ghcr.io/devclef/revenant:0.1.0`, which a GitOps repo then references via
`image.tag`.

## Chart version

Bump `version` in `Chart.yaml` on every change to the chart. `appVersion`
matches the app version in `package.json`.
