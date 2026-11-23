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
    def test_each_role_uses_its_expected_model(self):
        self.assertEqual(set(ga.MODELS), set(ga.DESCRIPTIONS))
        expected = {
            "qa": "claude-sonnet-5.5",
            "frontend-dev": "claude-sonnet-5.5",
            "platform-dev": "claude-haiku-5.5",
            "data-dev": "claude-haiku-5.5",
            "crypto-dev": "claude-haiku-5.5",
        }
        self.assertEqual(set(ga.DESCRIPTIONS), set(expected))
        for role, model in expected.items():
            self.assertEqual(ga.build(role, OWNERSHIP)["model"], model)

    def test_role_without_a_model_entry_has_no_field(self):
        with mock.patch.dict(ga.MODELS, clear=True):
            self.assertNotIn("model", ga.build("qa", OWNERSHIP))

    def test_denies_cover_agent_tooling_but_not_tools_qa(self):
        self.assertNotIn("tools/**", ga.OWNER_ONLY)
        self.assertNotIn("tools/qa/**", ga.OWNER_ONLY)
        for p in ("tools/agents/**", "tools/dispatcher/**", "tools/hooks/**"):
            self.assertIn(p, ga.OWNER_ONLY)

    def test_committed_files_match(self):
        for role in ga.DESCRIPTIONS:
            text = json.dumps(ga.build(role, OWNERSHIP), indent=2) + "\n"
            self.assertEqual((ROOT / ".kiro/agents" / f"{role}.json").read_text(), text)


if __name__ == "__main__":
    unittest.main()
