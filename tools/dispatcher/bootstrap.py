"""One-time repo setup: create labels and open an issue from a file.

    GITHUB_TOKEN=... python3 tools/dispatcher/bootstrap.py labels
    GITHUB_TOKEN=... python3 tools/dispatcher/bootstrap.py issue \
        tools/dispatcher/issues/01-skeleton-task-1.md \
        "[platform-dev] Scaffold the Next.js app with a placeholder landing page" \
        agent:platform-dev spec:01-skeleton status:ready

Idempotent: existing labels are updated, and an issue with the same title is
not opened twice.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from revenant_dispatch import GitHub  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def labels(gh: GitHub) -> None:
    existing = {l["name"] for l in gh.list(gh.r("/labels"))}
    for lbl in json.loads((ROOT / ".github/labels.json").read_text()):
        if lbl["name"] in existing:
            gh.call("PATCH", gh.r(f"/labels/{urllib.parse.quote(lbl['name'], safe='')}"),
                    {"color": lbl["color"], "description": lbl["description"]})
        else:
            gh.call("POST", gh.r("/labels"), lbl)
        print("label", lbl["name"])


def issue(gh: GitHub, body_file: str, title: str, *label_list: str) -> None:
    for i in gh.issues("all"):
        if i["title"] == title:
            print(f"already exists: #{i['number']}")
            return
    created = gh.call("POST", gh.r("/issues"), {
        "title": title, "body": Path(body_file).read_text(), "labels": list(label_list)})
    print(f"opened #{created['number']}: {created['html_url']}")


def main() -> None:
    gh = GitHub(os.environ["GITHUB_TOKEN"])
    cmd, *args = sys.argv[1:] or ["help"]
    if cmd == "labels":
        labels(gh)
    elif cmd == "issue" and len(args) >= 2:
        issue(gh, *args)
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
