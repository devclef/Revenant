import importlib.util
import json
import sys
import unittest
from unittest import mock
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location("generate_agents", ROOT / "tools/agents/generate_agents.py")
ga = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ga)

OWNERSHIP = json.loads((ROOT / ".github/agents.json").read_text())


class Models(unittest.TestCase):
    def test_every_role_uses_haiku(self):
        self.assertEqual(set(ga.MODELS), set(ga.DESCRIPTIONS))
        for role in ga.DESCRIPTIONS:
            self.assertEqual(ga.build(role, OWNERSHIP)["model"], "claude-haiku-5.5")

    def test_role_without_a_model_entry_has_no_field(self):
        with mock.patch.dict(ga.MODELS, clear=True):
            self.assertNotIn("model", ga.build("qa", OWNERSHIP))

    def test_committed_files_match(self):
        for role in ga.DESCRIPTIONS:
            text = json.dumps(ga.build(role, OWNERSHIP), indent=2) + "\n"
            self.assertEqual((ROOT / ".kiro/agents" / f"{role}.json").read_text(), text)


if __name__ == "__main__":
    unittest.main()
