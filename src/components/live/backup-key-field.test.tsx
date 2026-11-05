import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "./copy";
import { UnlockView } from "./UnlockView";

/**
 * The key-field-only path (spec 06 R17.10): a backup-only letter shows the key
 * field and no passkey control. A mistyped key shows its notice and keeps the
 * text the reader typed in the field.
 */

const controls = { ready: true, passkey: () => {}, backup: () => {} };

describe("key-field-only path (R17.10)", () => {
  it("shows the field and no passkey button for a backup-only letter", () => {
    const html = renderToStaticMarkup(
      <UnlockView
        unlock={{ passkey: null, backup: true }}
        notice={null}
        controls={controls}
        keyText=""
        onKeyTextChange={() => {}}
      />,
    );
    expect(html).toContain('id="unlock-backup-key"');
    expect(html).toContain(LIVE_COPY.backupOnly);
    expect(html).not.toContain(LIVE_COPY.unlockPasskey);
  });

  it("keeps the typed value and shows the mistyped notice, with no content", () => {
    const typed = "ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2";
    const html = renderToStaticMarkup(
      <UnlockView
        unlock={{ passkey: null, backup: true }}
        notice="mistyped_key"
        controls={controls}
        keyText={typed}
        onKeyTextChange={() => {}}
      />,
    );
    expect(html).toContain(`value="${typed}"`);
    expect(html).toContain(LIVE_COPY.noticeMistyped);
    expect(html).not.toContain(LIVE_COPY.unlockPasskey);
  });
});
