#!/usr/bin/env bash
# One entry point for "is this change OK?", used by agents, the Crew Task Runner
# test command, and CI. Each check runs only when the files it needs exist, so
# the script passes on an empty repo and tightens as the project grows.
# One exception: the Helm chart must exist, so moving it can't switch its lint off.
# Owner-only file: agents must not edit it.
set -euo pipefail
cd "$(dirname "$0")/.."
# Never leave .pyc files behind for an agent to commit.
export PYTHONDONTWRITEBYTECODE=1

ran=0
step() { echo; echo "==> $*"; ran=$((ran + 1)); }

if [[ -f tools/agents/generate_agents.py ]]; then
  step "agent files match .github/agents.json"
  python3 tools/agents/generate_agents.py --check
fi

if [[ -d tools/dispatcher/tests ]]; then
  step "dispatcher tests"
  python3 -m unittest discover -s tools/dispatcher/tests -q
fi

if [[ -f package.json ]]; then
  if [[ ! -f package-lock.json ]]; then
    if [[ -n "${CI:-}" ]]; then
      echo "package-lock.json is missing. Run 'npm install' and commit the lockfile." >&2
      exit 1
    fi
    # Mid-task (e.g. the scaffold step) a lockfile may not exist yet:
    # npm install creates it, npm ci would refuse to run.
    step "npm install (no lockfile yet; creates package-lock.json)"
    npm install --no-audit --no-fund
  elif [[ ! -d node_modules ]] || [[ package-lock.json -nt node_modules ]]; then
    step "npm ci"
    npm ci --no-audit --no-fund
  fi
  for s in lint typecheck test build; do
    if node -e "process.exit(require('./package.json').scripts?.['$s'] ? 0 : 1)"; then
      step "npm run $s"
      npm run --silent "$s"
    else
      echo "(no '$s' script yet; skipped)"
    fi
  done
  # next build rewrites next-env.d.ts when a Next upgrade changes its template.
  # A stale copy on main makes every agent's build dirty a platform-dev file,
  # which then fails the policy check on unrelated PRs. Catch it in CI instead.
  if [[ -n "${CI:-}" ]] && [[ -f next-env.d.ts ]] && ! git diff --quiet -- next-env.d.ts 2>/dev/null; then
    step "next-env.d.ts is up to date"
    git --no-pager diff -- next-env.d.ts >&2
    echo "next build rewrote next-env.d.ts. Commit the regenerated file." >&2
    exit 1
  fi
  if [[ -f scripts/check-js-budget.mjs ]]; then
    step "JS budget"
    node scripts/check-js-budget.mjs
  fi
  # Spec 17: the layout rules that blocked real screens. Needs Chromium and a
  # database with the personas sealed, so it runs in CI or with LAYOUT_CHECK=1
  # and is skipped on a bare laptop. Skipped until the gate script exists.
  if [[ -f tools/qa/layout-gate.mjs ]]; then
    if [[ -n "${CI:-}" || "${LAYOUT_CHECK:-}" == 1 ]]; then
      step "layout-check (blockers)"
      node tools/qa/layout-gate.mjs
    else
      echo "(layout-check skipped: set LAYOUT_CHECK=1 to run it; CI always does)"
    fi
  fi
fi

# Helm chart. During spec 20 the chart moves from deploy/helm/revenant to
# deploy/helm/efterhand, so either folder is checked. A missing chart fails even
# without helm, so a move cannot silently turn this check off.
chart_dirs=()
for d in deploy/helm/revenant deploy/helm/efterhand; do
  if [[ -f "$d/Chart.yaml" ]]; then chart_dirs+=("$d"); fi
done
if (( ${#chart_dirs[@]} == 0 )); then
  echo "No Helm chart found. Looked for deploy/helm/revenant/Chart.yaml and deploy/helm/efterhand/Chart.yaml." >&2
  exit 1
fi
if command -v helm >/dev/null; then
  for d in "${chart_dirs[@]}"; do
    step "helm lint and template: $d"
    helm lint "$d" || { echo "helm lint failed for $d" >&2; exit 1; }
    rendered=$(helm template ci "$d") || { echo "helm template failed for $d" >&2; exit 1; }
    if grep -q '^kind: Secret' <<<"$rendered"; then
      echo "Chart $d must not render a Secret (use existingSecret)." >&2
      exit 1
    fi
  done
fi

echo
echo "check.sh: $ran check(s) passed"
