import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location("generate_agents", ROOT / "tools/agents/generate_agents.py")
ga = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ga)

OWNERSHIP = json.loads((ROOT / ".github/agents.json").read_text())


class Models(unittest.TestCase):
    def test_only_listed_roles_get_a_model(self):
        self.assertEqual(ga.MODELS, {"data-dev": "claude-haiku-5.5", "frontend-dev": "claude-haiku-5.5"})
        for role in ga.DESCRIPTIONS:
            agent = ga.build(role, OWNERSHIP)
            if role in ga.MODELS:
                self.assertEqual(agent["model"], ga.MODELS[role])
            else:
                self.assertNotIn("model", agent)

    def test_qa_stays_on_auto(self):
        self.assertNotIn("model", ga.build("qa", OWNERSHIP))
        self.assertNotIn("model", json.loads((ROOT / ".kiro/agents/qa.json").read_text()))

    def test_committed_files_match(self):
        for role in ga.DESCRIPTIONS:
            text = json.dumps(ga.build(role, OWNERSHIP), indent=2) + "\n"
            self.assertEqual((ROOT / ".kiro/agents" / f"{role}.json").read_text(), text)


if __name__ == "__main__":
    unittest.main()
