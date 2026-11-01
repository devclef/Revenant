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
    # Same local-app set as qa (throwaway Postgres, migrate, seal personas, start the
    # app) so frontend-dev can look at its own work. See the qa note below.
    "frontend-dev": ["docker run*", "docker rm*", "docker stop*",
                     "npm run build", "npm start*", "npm run db:migrate", "npm run seal-personas*",
                     "PORT=* npm start*", "PORT=* DATABASE_URL=* npm start*",
                     "DATABASE_URL=* npm run db:migrate", "DATABASE_URL=* npm run seal-personas*",
                     "kill *"],
    "data-dev": CONTAINER_SHELL,
    # Tasks with integration tests pass DATABASE_URL inline for a local test database.
    "crypto-dev": [*CONTAINER_SHELL, "DATABASE_URL=* npm *", "DATABASE_URL=* bash scripts/check.sh*"],
    # QA runs the app locally for the browser check: a throwaway Postgres container,
    # migrations, the persona sealing script, and the app itself on a free port.
    # Env-prefixed forms are listed because "npm *" does not match "PORT=1 npm ...".
    # `kill *` cannot be limited to processes QA started (shell rules match command
    # text only); the QA prompt tells it to kill only the PIDs it recorded.
    "qa": ["git fetch origin*", "git merge-base*", "helm lint*", "helm template*",
           "docker run*", "docker rm*", "docker stop*",
           "npm run build", "npm start*", "npm run db:migrate", "npm run seal-personas*",
           "PORT=* npm start*", "PORT=* DATABASE_URL=* npm start*",
           "DATABASE_URL=* npm run db:migrate", "DATABASE_URL=* npm run seal-personas*",
           "kill *"],
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
# Browser for the qa and frontend-dev roles (headless Chromium via Playwright MCP). Version pinned
# exactly. Auto-named output goes outside the repo, and that folder is also the one
# allowed root for explicit absolute screenshot paths. kiro-cli does not expand $HOME
# in `env` values (it passed the text through), so a shell sets the variable instead.
# That keeps the committed file identical on every machine.
PLAYWRIGHT_VERSION = "0.0.83"
SHOTS_DIRS = {
    "qa": "$HOME/kiro/revenant-crew/qa-shots",
    "frontend-dev": "$HOME/kiro/revenant-crew/dev-shots",
}


def playwright_server(shots_dir: str) -> dict:
    return {
        "command": "sh",
        "args": [
            "-c",
            f'PLAYWRIGHT_MCP_OUTPUT_DIR="{shots_dir}" exec npx -y @playwright/mcp@{PLAYWRIGHT_VERSION}'
            " --headless --browser chromium --isolated --file-paths absolute",
        ],
        "timeout": 120000,
    }


# Not needed for walking pages; both reach beyond the browser (server-side code, local files).
PLAYWRIGHT_DENY = ["playwright/browser_run_code_unsafe", "playwright/browser_file_upload"]
MCP_SERVERS = {role: {"playwright": playwright_server(d)} for role, d in SHOTS_DIRS.items()}
OWNER_ONLY = [".kiro/**", ".github/**", "tools/**", "scripts/check.sh"]

# Hooks (kiro-cli object form). The scripts live in tools/hooks/ (owner-only) and
# always exit 0. frontend-dev's stop hook may ask for one more turn (once per
# session) when the tone check finds something. See docs/agent-loop.md.
HOOK_TIMEOUT_MS = 60000
TONE_CHECK_STOP = {"command": "node tools/hooks/tone-check.mjs --role frontend-dev", "timeout_ms": HOOK_TIMEOUT_MS}
HOOKS = {
    "frontend-dev": {"stop": [TONE_CHECK_STOP]},
    "crypto-dev": {},
    "data-dev": {},
    "platform-dev": {},
    "qa": {},
}


def build(role: str, ownership: dict) -> dict:
    if role == "qa":
        write = [".qa/**"]
        shell = [s for s in COMMON_SHELL if not s.startswith(("git add", "git commit"))]
        shell += ["git add .qa*", "git commit *"]
    else:
        write = sorted(set(ownership["roles"][role] + ownership["shared"]))
        shell = list(COMMON_SHELL)
    mcp_servers = json.loads(json.dumps(MCP_SERVERS.get(role, {})))
    rules = [
        {"capability": "fs_read", "effect": "allow"},
        {"capability": "fs_write", "match": write, "effect": "allow"},
        {"capability": "fs_write", "match": OWNER_ONLY, "effect": "deny"},
        {"capability": "shell", "match": shell + EXTRA_SHELL[role], "effect": "allow"},
        {"capability": "shell", "match": DENY_SHELL, "effect": "deny"},
    ]
    if "playwright" in mcp_servers:
        rules += [
            {"capability": "mcp", "match": ["playwright/*"], "effect": "allow"},
            {"capability": "mcp", "match": PLAYWRIGHT_DENY, "effect": "deny"},
        ]
    return {
        "name": role,
        "description": DESCRIPTIONS[role],
        "prompt": f"file://./prompts/{role}.md",
        "tools": ["fs_read", "fs_write", "execute_bash", "grep", "glob", "code", *(f"@{n}" for n in mcp_servers)],
        # Kiro Crew 0.10 bundles kiro-cli-chat 2.27, which skips an agent that has
        # `permissions` but no `allowedTools`. Read-only tools (plus the qa browser server) only: writes and
        # shell stay governed by the permission rules below.
        "allowedTools": ["fs_read", "grep", "glob", "code", *(f"@{n}" for n in mcp_servers)],
        "includeMcpJson": False,
        "mcpServers": mcp_servers,
        "hooks": json.loads(json.dumps(HOOKS[role])),
        "resources": ["file://.kiro/steering/**/*.md", "file://.kiro/agents/prompts/common.md"],
        "permissions": {"rules": rules},
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
