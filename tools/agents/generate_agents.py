#!/usr/bin/env python3
"""Generate .kiro/agents/<role>.json from .github/agents.json.

Run from the repo root after changing role ownership:
    python3 tools/agents/generate_agents.py
CI checks the committed agent files match this output.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

DESCRIPTIONS = {
    "platform-dev": "Revenant platform engineer: scaffold, config, health routes, DB client and migrations, Dockerfile, Helm chart.",
    "frontend-dev": "Revenant UI engineer: pages, components, styling, cards, .ics, recall wording, persona text.",
    "data-dev": "Revenant data engineer: source adapters, figure catalogue, fetch job, figures API and tables.",
    "crypto-dev": "Revenant crypto engineer: browser crypto, sealed format, letter/opening APIs, sealed tables and triggers.",
    "qa": "Revenant independent reviewer: checks a PR against its ticket and the steering docs, writes .qa/verdict.json.",
}

COMMON_SHELL = [
    "npm *", "npx *", "node *", "bash scripts/check.sh*",
    "git status*", "git diff*", "git log*", "git show*", "git add *", "git commit *",
    "git rev-parse*", "git ls-files*", "ls*", "mkdir *", "pwd",
]
CONTAINER_SHELL = ["docker run*", "docker rm*", "docker stop*", "docker logs*"]
EXTRA_SHELL = {
    "platform-dev": ["docker build*", *CONTAINER_SHELL, "helm lint*", "helm template*",
                     "curl *localhost*", "curl *127.0.0.1*"],
    "frontend-dev": [],
    "data-dev": CONTAINER_SHELL,
    # Tasks with integration tests pass DATABASE_URL inline for a local test database.
    "crypto-dev": [*CONTAINER_SHELL, "DATABASE_URL=* npm *", "DATABASE_URL=* bash scripts/check.sh*"],
    "qa": ["git fetch origin*", "git merge-base*", "helm lint*", "helm template*"],
}
DENY_SHELL = [
    "git push*", "git remote*", "git config*", "git reset*", "git checkout main*",
    "gh *", "sudo *", "kubectl *", "helm install*", "helm upgrade*",
    "rm -rf /*", "rm -rf ~*", "env", "printenv*", "*github.com*", "*api.github*",
    # Keep every command inside the worktree: no changing directory, no
    # installs aimed elsewhere, no global installs. An npm install in a parent
    # folder creates a second lockfile and confuses Next.js's workspace root.
    "cd *", "*&& cd *", "*; cd *", "pushd *", "*--prefix*", "npm -g*", "npm * -g*",
    "npm *--global*", "npx --yes*", "*~/*", "*$HOME*", "*/home/*",
]
OWNER_ONLY = [".kiro/**", ".github/**", "tools/**", "scripts/check.sh"]


def build(role: str, ownership: dict) -> dict:
    if role == "qa":
        write = [".qa/**"]
        shell = [s for s in COMMON_SHELL if not s.startswith(("git add", "git commit"))]
        shell += ["git add .qa*", "git commit *"]
    else:
        write = sorted(set(ownership["roles"][role] + ownership["shared"]))
        shell = list(COMMON_SHELL)
    return {
        "name": role,
        "description": DESCRIPTIONS[role],
        "prompt": f"file://./prompts/{role}.md",
        "tools": ["fs_read", "fs_write", "execute_bash", "grep", "glob", "code"],
        # Kiro Crew 0.10 bundles kiro-cli-chat 2.27, which skips an agent that has
        # `permissions` but no `allowedTools`. Read-only tools only: writes and
        # shell stay governed by the permission rules below.
        "allowedTools": ["fs_read", "grep", "glob", "code"],
        "includeMcpJson": False,
        "mcpServers": {},
        "resources": ["file://.kiro/steering/**/*.md", "file://.kiro/agents/prompts/common.md"],
        "permissions": {
            "rules": [
                {"capability": "fs_read", "effect": "allow"},
                {"capability": "fs_write", "match": write, "effect": "allow"},
                {"capability": "fs_write", "match": OWNER_ONLY, "effect": "deny"},
                {"capability": "shell", "match": shell + EXTRA_SHELL[role], "effect": "allow"},
                {"capability": "shell", "match": DENY_SHELL, "effect": "deny"},
            ]
        },
    }


def install_global(ownership: dict) -> None:
    """Copy the role agents into ~/.kiro/agents for Kiro Crew.

    The Crew Task Runner starts some sessions (planning) outside the repo, so
    kiro-cli only finds global agents there. Prompts go to
    ~/.kiro/agents/revenant-prompts/ to avoid clashing with other agents.
    Steering stays a cwd-relative resource, so runs still read the repo's copy.
    """
    home = Path.home() / ".kiro" / "agents"
    prompts = home / "revenant-prompts"
    prompts.mkdir(parents=True, exist_ok=True)
    for src in (ROOT / ".kiro/agents/prompts").glob("*.md"):
        (prompts / src.name).write_text(src.read_text())
    for role in DESCRIPTIONS:
        agent = build(role, ownership)
        agent["prompt"] = f"file://./revenant-prompts/{role}.md"
        agent["resources"] = ["file://.kiro/steering/**/*.md", f"file://{prompts / 'common.md'}"]
        (home / f"{role}.json").write_text(json.dumps(agent, indent=2) + "\n")
        print(f"installed {home / f'{role}.json'}")


def main() -> int:
    ownership = json.loads((ROOT / ".github/agents.json").read_text())
    if "--install-global" in sys.argv:
        install_global(ownership)
        return 0
    check = "--check" in sys.argv
    stale = []
    for role in DESCRIPTIONS:
        path = ROOT / ".kiro/agents" / f"{role}.json"
        text = json.dumps(build(role, ownership), indent=2) + "\n"
        if check:
            if not path.exists() or path.read_text() != text:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.write_text(text)
    if stale:
        print("Agent files out of date; run tools/agents/generate_agents.py:", *stale, sep="\n  ")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
