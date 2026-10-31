import { describe, expect, it } from "vitest";
import { parseBackupKey } from "./backup-key";
import { PUBLIC_DEMO_BACKUP_KEY } from "./demo-key";

// The public demo backup key is committed in source and opens demo persona
// letters only. It must parse cleanly through the same strict parser a real
// key uses, so a persona letter sealed with it can always be opened.
describe("PUBLIC_DEMO_BACKUP_KEY", () => {
  it("parses successfully and yields 16 bytes", () => {
    const parsed = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.key).toHaveLength(16);
    }
  });

  it("is in the hyphenated 27-character card form", () => {
    expect(PUBLIC_DEMO_BACKUP_KEY.replace(/-/g, "")).toHaveLength(27);
  });
});
