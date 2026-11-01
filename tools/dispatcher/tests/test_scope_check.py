import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools" / "dispatcher"))
sys.dont_write_bytecode = True

import pr_policy  # noqa: E402

_spec = importlib.util.spec_from_file_location("scope_check", ROOT / "tools" / "hooks" / "scope-check.py")
sc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sc)

OWNERSHIP = json.loads((ROOT / ".github/agents.json").read_text())


def f(name, add=1, dele=0):
    return {"filename": name, "additions": add, "deletions": dele}


class CheckFiles(unittest.TestCase):
    def test_owned_file_is_clean(self):
        self.assertEqual(pr_policy.check_files("frontend-dev", [f("src/components/a.tsx")], OWNERSHIP), [])

    def test_shared_file_is_clean(self):
        self.assertEqual(pr_policy.check_files("data-dev", [f("package.json")], OWNERSHIP), [])

    def test_outside_owned_paths(self):
        errs = pr_policy.check_files("data-dev", [f("src/components/a.tsx")], OWNERSHIP)
        self.assertEqual(len(errs), 1)
        self.assertIn("outside `data-dev`'s owned paths", errs[0])

    def test_owner_only(self):
        errs = pr_policy.check_files("platform-dev", [f("tools/x.py"), f(".kiro/a.md")], OWNERSHIP)
        self.assertEqual(len(errs), 2)
        self.assertTrue(all("owner-only" in e for e in errs))

    def test_size_limit_and_excluded_files(self):
        limit = OWNERSHIP["max_changed_lines"]
        errs = pr_policy.check_files("platform-dev", [f("Dockerfile", limit + 1)], OWNERSHIP)
        self.assertIn("line limit", errs[0])
        self.assertEqual(pr_policy.check_files("platform-dev", [f("package-lock.json", limit * 2)], OWNERSHIP), [])


def git(cwd, *args):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True,
                   env={"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t",
                        "GIT_COMMITTER_EMAIL": "t@t", "PATH": "/usr/bin:/bin:/usr/local/bin"})


class ChangedFiles(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        git(self.dir, "init", "-q", "-b", "main")
        (self.dir / "keep.txt").write_text("a\nb\n")
        git(self.dir, "add", ".")
        git(self.dir, "commit", "-q", "-m", "base")
        git(self.dir, "checkout", "-q", "-b", "work")

    def test_committed_modified_and_untracked(self):
        (self.dir / "committed.txt").write_text("1\n2\n3\n")
        git(self.dir, "add", ".")
        git(self.dir, "commit", "-q", "-m", "c")
        (self.dir / "keep.txt").write_text("a\nb\nc\n")
        (self.dir / "new.txt").write_text("x\ny")
        got = {x["filename"]: (x["additions"], x["deletions"]) for x in sc.changed_files(str(self.dir))}
        self.assertEqual(got, {"committed.txt": (3, 0), "keep.txt": (1, 0), "new.txt": (2, 0)})

    def test_nothing_changed(self):
        self.assertEqual(sc.changed_files(str(self.dir)), [])


class Run(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.markers = Path(self.tmp.name) / "markers"
        self.logs = []
        p = mock.patch.object(sc, "log", lambda role, files, result: self.logs.append((role, files, result)))
        p.start()
        self.addCleanup(p.stop)

    def run_hook(self, files, role="data-dev", session="s1", raw=None):
        raw = raw if raw is not None else json.dumps({"cwd": self.tmp.name, "session_id": session})
        with mock.patch.object(sc, "changed_files", lambda cwd: files):
            return sc.run(role, raw, OWNERSHIP, self.markers)

    def test_clean(self):
        self.assertIsNone(self.run_hook([f("src/lib/sources/a.ts")]))
        self.assertEqual(self.logs[-1][2], "clean")

    def test_no_files(self):
        self.assertIsNone(self.run_hook([]))
        self.assertEqual(self.logs[-1][2], "clean:no-files")

    def test_blocks_once_per_session_with_file_level_findings(self):
        files = [f("src/components/a.tsx"), f("tools/x.py")]
        out = json.loads(self.run_hook(files))
        self.assertEqual(out["decision"], "block")
        self.assertIn("`src/components/a.tsx` is outside", out["reason"])
        self.assertIn("`tools/x.py` is owner-only", out["reason"])
        self.assertEqual(self.logs[-1][2], "block:2")
        second = self.run_hook(files)
        self.assertNotIn("decision", second)
        self.assertIn("not blocking again", second)
        self.assertEqual(self.logs[-1][2], "report:2")
        # a different session blocks again
        self.assertEqual(json.loads(self.run_hook(files, session="s2"))["decision"], "block")

    def test_no_session_id_never_blocks(self):
        out = self.run_hook([f("tools/x.py")], session="")
        self.assertIn("not blocking again", out)

    def test_bad_session_id_never_blocks(self):
        out = self.run_hook([f("tools/x.py")], session="../etc")
        self.assertIn("not blocking again", out)

    def test_garbage_input(self):
        self.assertIsNone(self.run_hook([f("tools/x.py")], raw="not json"))
        self.assertEqual(self.logs[-1][2], "skipped:bad-input")
        self.assertIsNone(self.run_hook([f("tools/x.py")], raw="[1]"))

    def test_unknown_role_skipped(self):
        self.assertIsNone(self.run_hook([f("tools/x.py")], role="qa"))
        self.assertEqual(self.logs[-1][2], "skipped:unknown-role")

    def test_git_error_skipped(self):
        def boom(cwd):
            raise RuntimeError
        with mock.patch.object(sc, "changed_files", boom):
            self.assertIsNone(sc.run("data-dev", json.dumps({"session_id": "s"}), OWNERSHIP, self.markers))
        self.assertEqual(self.logs[-1][2], "skipped:git-error")


class Script(unittest.TestCase):
    def test_exits_zero_on_garbage(self):
        r = subprocess.run([sys.executable, str(ROOT / "tools/hooks/scope-check.py"), "--role", "data-dev"],
                           input="garbage", capture_output=True, text=True)
        self.assertEqual(r.returncode, 0)
        self.assertEqual(r.stdout, "")

    def test_generated_hooks(self):
        for role in ("platform-dev", "frontend-dev", "data-dev", "crypto-dev"):
            agent = json.loads((ROOT / f".kiro/agents/{role}.json").read_text())
            cmds = [h["command"] for h in agent["hooks"]["stop"]]
            self.assertIn(f"python3 tools/hooks/scope-check.py --role {role}", cmds)
        self.assertNotIn("stop", json.loads((ROOT / ".kiro/agents/qa.json").read_text())["hooks"])


if __name__ == "__main__":
    unittest.main()
