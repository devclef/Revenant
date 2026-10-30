#!/usr/bin/env bash
# One entry point for "is this change OK?", used by agents, the Crew Task Runner
# test command, and CI. Each check runs only when the files it needs exist, so
# the script passes on an empty repo and tightens as the project grows.
# Owner-only file: agents must not edit it.
set -euo pipefail
cd "$(dirname "$0")/.."

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
fi

if [[ -f deploy/helm/revenant/Chart.yaml ]] && command -v helm >/dev/null; then
  step "helm lint and template"
  helm lint deploy/helm/revenant
  rendered=$(helm template ci deploy/helm/revenant)
  if grep -q '^kind: Secret' <<<"$rendered"; then
    echo "Chart must not render a Secret (use existingSecret)." >&2
    exit 1
  fi
fi

echo
echo "check.sh: $ran check(s) passed"
