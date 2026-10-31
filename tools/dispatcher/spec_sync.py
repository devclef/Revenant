"""Open one GitHub issue per task in .kiro/specs/*/tasks.md.

Run by .github/workflows/spec-sync.yml on every push to main that touches a
spec, so new tasks become claimable issues without anyone opening them.

Idempotent. Each issue carries a hidden marker `<!-- spec-task: <spec>/<n> -->`.
An existing issue is matched by that marker, or (for issues opened before the
marker existed) by its exact title, which then gets the marker added.
"Depends on: 2, 5" in tasks.md becomes "Depends on: #<issue for task 2>, ...",
so the dispatcher only claims a task once its dependencies are closed.
"""
from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from revenant_dispatch import GitHub  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
REPO_URL = "https://github.com/devclef/Revenant/blob/main"
_TASK_RE = re.compile(r"^- \[[ xX]\] (\d+)\. (.+)$")
_MARKER_RE = re.compile(r"<!--\s*spec-task:\s*([\w.-]+/\d+)\s*-->")


@dataclass
class Task:
    spec: str
    number: int
    title: str
    agent: str
    depends: list[int]
    detail: str

    @property
    def key(self) -> str:
        return f"{self.spec}/{self.number}"

    @property
    def issue_title(self) -> str:
        return f"[{self.agent}] {self.title}"


def parse_tasks(spec: str, text: str) -> list[Task]:
    tasks: list[Task] = []
    current: dict | None = None
    for line in text.splitlines():
        m = _TASK_RE.match(line)
        if m:
            if current:
                tasks.append(_finish(spec, current))
            current = {"n": int(m.group(1)), "title": m.group(2), "lines": []}
        elif current is not None and (line.startswith("  ") or not line.strip()):
            current["lines"].append(line[2:] if line.startswith("  ") else line)
        elif current is not None:
            tasks.append(_finish(spec, current))
            current = None
    if current:
        tasks.append(_finish(spec, current))
    return tasks


def _finish(spec: str, raw: dict) -> Task:
    detail = "\n".join(raw["lines"]).strip("\n")
    agent = re.search(r"Agent:\s*`([\w-]+)`", detail)
    deps = re.search(r"Depends on:\s*([^\n·]+)", detail)
    depends = [int(n) for n in re.findall(r"\d+", deps.group(1))] if deps else []
    title = re.sub(r"\s*\*\*\(.*?\)\*\*\s*$", "", raw["title"]).strip()
    if not agent:
        raise ValueError(f"{spec} task {raw['n']} has no `Agent:` line")
    return Task(spec, raw["n"], title, agent.group(1), depends, detail)


def issue_body(task: Task, dep_issues: list[int]) -> str:
    deps = ", ".join(f"#{n}" for n in dep_issues) or "none"
    return (
        f"**Spec:** [.kiro/specs/{task.spec}/tasks.md]({REPO_URL}/.kiro/specs/{task.spec}/tasks.md)"
        f" · Task {task.number} · Design: [.kiro/specs/{task.spec}/design.md]"
        f"({REPO_URL}/.kiro/specs/{task.spec}/design.md)\n"
        f"**Agent:** {task.agent}\n"
        f"**Depends on:** {deps}\n\n"
        f"## Task\n\n{task.detail}\n\n"
        "## Validation\n\n```bash\nbash scripts/check.sh\n```\n\n"
        f"<!-- spec-task: {task.key} -->\n"
    )


def plan(tasks: list[Task], existing: list[dict]) -> list[tuple[str, Task, dict | None]]:
    """Return actions: ("create", task, None) or ("mark", task, issue)."""
    by_marker: dict[str, dict] = {}
    by_title: dict[str, dict] = {}
    for i in existing:
        m = _MARKER_RE.search(i.get("body") or "")
        if m:
            by_marker[m.group(1)] = i
        by_title.setdefault(i["title"], i)
    actions = []
    for t in tasks:
        if t.key in by_marker:
            continue
        if t.issue_title in by_title:
            actions.append(("mark", t, by_title[t.issue_title]))
        else:
            actions.append(("create", t, None))
    return actions


def issue_numbers(existing: list[dict]) -> dict[str, int]:
    out = {}
    for i in existing:
        m = _MARKER_RE.search(i.get("body") or "")
        if m:
            out[m.group(1)] = i["number"]
    return out


def sync(gh: GitHub, dry_run: bool = False) -> list[str]:
    log = []
    existing = [i for i in gh.issues("all") if "pull_request" not in i]
    numbers = issue_numbers(existing)
    for path in sorted((ROOT / ".kiro/specs").glob("*/tasks.md")):
        spec = path.parent.name
        tasks = parse_tasks(spec, path.read_text())
        for action, task, issue in plan(tasks, existing):
            if action == "mark":
                body = (issue.get("body") or "").rstrip() + f"\n\n<!-- spec-task: {task.key} -->\n"
                if not dry_run:
                    gh.call("PATCH", gh.r(f"/issues/{issue['number']}"), {"body": body})
                numbers[task.key] = issue["number"]
                log.append(f"marked #{issue['number']} as {task.key}")
                continue
            missing = [d for d in task.depends if f"{spec}/{d}" not in numbers]
            if missing:
                log.append(f"skipped {task.key}: dependencies {missing} have no issue yet")
                continue
            deps = [numbers[f"{spec}/{d}"] for d in task.depends]
            if dry_run:
                numbers[task.key] = -task.number
                log.append(f"would open {task.issue_title} (deps {deps})")
                continue
            created = gh.call("POST", gh.r("/issues"), {
                "title": task.issue_title,
                "body": issue_body(task, deps),
                "labels": [f"agent:{task.agent}", f"spec:{spec}", "status:ready"],
            })
            numbers[task.key] = created["number"]
            log.append(f"opened #{created['number']} {task.issue_title}")
    return log


def main() -> int:
    gh = GitHub(os.environ["GITHUB_TOKEN"], os.environ.get("REPO", "devclef/Revenant"))
    for line in sync(gh, dry_run="--dry-run" in sys.argv):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
