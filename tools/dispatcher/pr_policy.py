"""PR policy check, run by .github/workflows/pr-policy.yml from main's copy.

Rules for agent PRs:
  - the body links an issue with "Closes #n"
  - that issue has exactly one agent:* label
  - every changed file is owned by that agent (or shared) per .github/agents.json
  - no owner-only paths (.kiro/**, .github/**, tools/**, scripts/check.sh)
  - changed lines (excluding generated files) stay under max_changed_lines

PRs labelled "owner" and opened by the repository owner are exempt.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OWNER_ONLY = [".kiro/**", ".github/**", "tools/**", "scripts/check.sh", ".qa/**"]


def glob_to_regex(pattern: str) -> re.Pattern:
    out, i = "", 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out += r"(?:.*/)?"
            i += 3
        elif pattern.startswith("**", i):
            out += r".*"
            i += 2
        elif pattern[i] == "*":
            out += r"[^/]*"
            i += 1
        elif pattern[i] == "?":
            out += r"[^/]"
            i += 1
        else:
            out += re.escape(pattern[i])
            i += 1
    return re.compile(rf"^{out}$")


def matches(path: str, patterns: list[str]) -> bool:
    return any(glob_to_regex(p).match(path) for p in patterns)


def evaluate(pr: dict, issue: dict | None, files: list[dict], ownership: dict, owner: str) -> list[str]:
    labels = {l["name"] for l in pr.get("labels", [])}
    trusted_author = (pr.get("user") or {}).get("login") == owner or pr.get("author_association") in (
        "OWNER", "MEMBER", "COLLABORATOR")
    if "owner" in labels and trusted_author:
        return []
    if issue is None:
        return ["PR body must link its issue with `Closes #<n>`."]
    roles = [l["name"][6:] for l in issue.get("labels", []) if l["name"].startswith("agent:")]
    if len(roles) != 1 or roles[0] not in ownership["roles"]:
        return [f"Issue #{issue['number']} must have exactly one known agent:* label (found {roles})."]
    return check_files(roles[0], files, ownership)


def check_files(role: str, files: list[dict], ownership: dict) -> list[str]:
    """Path and size rules for one role. Needs no GitHub API: `files` is a list
    of {"filename", "additions", "deletions"}. Shared by evaluate() and the
    scope-check agent hook."""
    errors: list[str] = []
    allowed = ownership["roles"][role] + ownership["shared"]
    size = 0
    for f in files:
        path = f["filename"]
        if matches(path, OWNER_ONLY):
            errors.append(f"`{path}` is owner-only.")
        elif not matches(path, allowed):
            errors.append(f"`{path}` is outside `{role}`'s owned paths.")
        if not matches(path, ownership.get("exclude_from_size", [])):
            size += int(f.get("additions", 0)) + int(f.get("deletions", 0))
    limit = int(ownership.get("max_changed_lines", 2000))
    if size > limit:
        errors.append(f"{size} changed lines is over the {limit}-line limit; split the ticket.")
    return errors


def _get(path: str, token: str) -> object:
    req = urllib.request.Request(f"https://api.github.com{path}", headers={
        "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def main() -> int:
    token, repo, number = os.environ["GH_TOKEN"], os.environ["REPO"], os.environ["PR"]
    pr = _get(f"/repos/{repo}/pulls/{number}", token)
    files, page = [], 1
    while True:
        chunk = _get(f"/repos/{repo}/pulls/{number}/files?per_page=100&page={page}", token)
        files += chunk
        if len(chunk) < 100:
            break
        page += 1
    m = re.search(r"(?i)\b(?:closes|fixes|resolves)\s+#(\d+)", pr.get("body") or "")
    issue = _get(f"/repos/{repo}/issues/{m.group(1)}", token) if m else None
    ownership = json.loads((ROOT / ".github/agents.json").read_text())
    errors = evaluate(pr, issue, files, ownership, owner=repo.split("/")[0])
    for e in errors:
        print(f"::error::{e}")
    if not errors:
        print("PR policy passed.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
