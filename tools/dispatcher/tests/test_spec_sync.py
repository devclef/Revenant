import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import revenant_dispatch as d  # noqa: E402
import spec_sync as s  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]


class Parse(unittest.TestCase):
    def test_skeleton_spec(self):
        tasks = s.parse_tasks("01-skeleton", (ROOT / ".kiro/specs/01-skeleton/tasks.md").read_text())
        self.assertEqual([t.number for t in tasks], list(range(1, 11)))
        self.assertEqual(tasks[0].title, "Scaffold the Next.js app with a placeholder landing page")
        self.assertEqual(tasks[0].depends, [])
        self.assertEqual(tasks[5].depends, [4, 5])
        self.assertEqual(tasks[8].agent, "frontend-dev")
        self.assertIn("Acceptance:", tasks[1].detail)


class Plan(unittest.TestCase):
    def test_marks_by_title_then_creates_rest(self):
        tasks = s.parse_tasks("01-skeleton", (ROOT / ".kiro/specs/01-skeleton/tasks.md").read_text())
        existing = [{"number": 1, "title": tasks[0].issue_title, "body": "old body"}]
        actions = s.plan(tasks, existing)
        self.assertEqual(actions[0][0], "mark")
        self.assertEqual([a for a, *_ in actions[1:]], ["create"] * 9)

    def test_marker_makes_it_idempotent(self):
        tasks = s.parse_tasks("01-skeleton", (ROOT / ".kiro/specs/01-skeleton/tasks.md").read_text())
        existing = [{"number": 10 + t.number, "title": t.issue_title,
                     "body": f"<!-- spec-task: {t.key} -->"} for t in tasks]
        self.assertEqual(s.plan(tasks, existing), [])

    def test_body_dependencies_parse_for_dispatcher(self):
        t = s.Task("01-skeleton", 6, "x", "platform-dev", [4, 5], "detail")
        self.assertEqual(d.parse_dependencies(s.issue_body(t, [5, 6])), [5, 6])
        self.assertEqual(d.parse_dependencies(s.issue_body(t, [])), [])

    def test_body_has_no_validation_section(self):
        t = s.Task("01-skeleton", 6, "x", "platform-dev", [], "detail")
        body = s.issue_body(t, [])
        self.assertNotIn("## Validation", body)
        self.assertIn("## Task\n\ndetail", body)
        self.assertIn(f"<!-- spec-task: {t.key} -->", body)


class Checks(unittest.TestCase):
    def test_check_state(self):
        self.assertEqual(d.check_state([]), "pending")
        self.assertEqual(d.check_state([{"status": "in_progress"}]), "pending")
        old = {"status": "completed", "conclusion": "failure", "started_at": "1"}
        new = {"status": "completed", "conclusion": "success", "started_at": "2"}
        self.assertEqual(d.check_state([old, new]), "success")


if __name__ == "__main__":
    unittest.main()


class Tick(unittest.TestCase):
    def test_ticks_only_done_tasks_and_never_unticks(self):
        text = "- [ ] 1. A\n  - Agent: `x`\n- [x] 2. B\n- [ ] 3. C\n"
        self.assertEqual(s.tick_text(text, {1, 2}), "- [x] 1. A\n  - Agent: `x`\n- [x] 2. B\n- [ ] 3. C\n")
        self.assertEqual(s.tick_text(text, set()), text)

    def test_only_completed_issues_count(self):
        body = "<!-- spec-task: a/1 -->"
        issues = [
            {"state": "closed", "state_reason": "completed", "body": body},
            {"state": "closed", "state_reason": "not_planned", "body": "<!-- spec-task: a/2 -->"},
            {"state": "open", "state_reason": None, "body": "<!-- spec-task: a/3 -->"},
            {"state": "closed", "state_reason": "completed", "body": "no marker"},
        ]
        self.assertEqual(s.completed_keys(issues), {"a/1"})
