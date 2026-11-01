#!/usr/bin/env python3
"""Crew agent hook ("stop" event): path ownership and size check on the files
changed in this run. Owner-only (tools/** is denied to agents).

Usage: python3 tools/hooks/scope-check.py --role <role>

Uses the same rules as the `policy` CI check (tools/dispatcher/pr_policy.py,
check_files): every changed file must be owned by the role, no owner-only
paths, and changed lines stay under the limit in .github/agents.json.

Changed files = git diff against the merge-base with origin/main (committed
and uncommitted) plus untracked files. On findings it prints
{"decision":"block","reason":"..."} so the agent takes another turn. It blocks
at most once per session_id (marker under the OS temp dir, outside the repo).
A second stop in the same session prints the findings but does not block.
Errors, a missing session_id and garbage input never block: always exit 0.
Every run appends one line to ~/kiro/revenant-crew/hooks.log (outside the repo).
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "dispatcher"))
sys.dont_write_bytecode = True

HOOK_NAME = "scope-check"
LOG_FILE = Path.home() / "kiro" / "revenant-crew" / "hooks.log"
ROLES = ("platform-dev", "frontend-dev", "data-dev", "crypto-dev")
MAX_SHOWN = 20


def log(role: str, files: list[str], result: str) -> None:
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        listing = ",".join(files) if files else "-"
        with LOG_FILE.open("a") as fh:
            fh.write(f"{stamp} role={role} hook={HOOK_NAME} files={len(files)} [{listing}] result={result}\n")
    except Exception:
        pass  # Logging must never affect the run.


def git(cwd: str, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True,
                          timeout=20, check=True).stdout


def changed_files(cwd: str) -> list[dict]:
    """Files changed since the merge-base with origin/main, as
    {"filename", "additions", "deletions"}, plus untracked files."""
    base = ""
    for ref in ("origin/main", "main"):
        try:
            base = git(cwd, "merge-base", "HEAD", ref).strip()
        except Exception:
            continue
        if base:
            break
    out: dict[str, dict] = {}
    for line in git(cwd, "diff", "--numstat", base or "HEAD").splitlines():
        parts = line.split("\t", 2)
        if len(parts) != 3:
            continue
        add, dele, name = parts
        out[name] = {"filename": name,
                     "additions": int(add) if add.isdigit() else 0,
                     "deletions": int(dele) if dele.isdigit() else 0}
    for name in git(cwd, "ls-files", "--others", "--exclude-standard").splitlines():
        name = name.strip()
        if not name or name in out:
            continue
        try:
            data = (Path(cwd) / name).read_bytes()
            lines = 0 if b"\0" in data else data.count(b"\n") + (1 if data and not data.endswith(b"\n") else 0)
        except OSError:
            lines = 0
        out[name] = {"filename": name, "additions": lines, "deletions": 0}
    return sorted(out.values(), key=lambda f: f["filename"])


def findings_for(role: str, files: list[dict], ownership: dict) -> list[str]:
    import pr_policy
    return pr_policy.check_files(role, files, ownership)


def can_block_once(session_id: str, marker_dir: Path | None = None) -> bool:
    """True the first time a valid session_id is seen; records a marker."""
    import re
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,128}", session_id or ""):
        return False
    directory = marker_dir or Path(tempfile.gettempdir()) / "revenant-hooks"
    marker = directory / f"{HOOK_NAME}-{session_id}"
    if marker.exists():
        return False
    try:
        directory.mkdir(parents=True, exist_ok=True)
        marker.write_text(datetime.now(timezone.utc).isoformat())
        return True
    except OSError:
        return False


def run(role: str, raw: str, ownership: dict, marker_dir: Path | None = None) -> str | None:
    """Returns the text to print, or None. Logs the result."""
    try:
        event = json.loads(raw)
        if not isinstance(event, dict):
            raise ValueError
    except ValueError:
        log(role, [], "skipped:bad-input")
        return None
    cwd = event.get("cwd") if isinstance(event.get("cwd"), str) and event.get("cwd") else str(Path.cwd())
    session_id = event.get("session_id") if isinstance(event.get("session_id"), str) else ""
    if role not in ROLES:
        log(role, [], "skipped:unknown-role")
        return None
    try:
        files = changed_files(cwd)
    except Exception:
        log(role, [], "skipped:git-error")
        return None
    names = [f["filename"] for f in files]
    if not files:
        log(role, [], "clean:no-files")
        return None
    hits = findings_for(role, files, ownership)
    if not hits:
        log(role, names, "clean")
        return None
    shown = hits[:MAX_SHOWN]
    text = "\n".join(shown) + (f"\n...and {len(hits) - len(shown)} more" if len(hits) > len(shown) else "")
    if can_block_once(session_id, marker_dir):
        reason = (f"scope-check found {len(hits)} issue(s):\n{text}\n"
                  "Move or revert these changes so only files owned by your role change, "
                  "and keep the change within the size limit, then finish.")
        log(role, names, f"block:{len(hits)}")
        return json.dumps({"decision": "block", "reason": reason})
    log(role, names, f"report:{len(hits)}")
    return f"scope-check: {len(hits)} issue(s) remain (not blocking again):\n{text}"


def main(argv: list[str]) -> None:
    role = argv[argv.index("--role") + 1] if "--role" in argv and argv.index("--role") + 1 < len(argv) else "unknown"
    try:
        ownership = json.loads((HERE.parents[1] / ".github" / "agents.json").read_text())
        out = run(role, sys.stdin.read(), ownership)
        if out:
            print(out)
    except Exception:
        log(role, [], "skipped:error")


if __name__ == "__main__":
    main(sys.argv[1:])
    sys.exit(0)
