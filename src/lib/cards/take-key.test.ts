import { describe, expect, it, vi } from "vitest";

import { takeBackupKeyFromLocation } from "./fragment";

function fakeWindow(hash: string, pathname = "/l/abc", search = "") {
  const replaceState = vi.fn();
  return {
    win: {
      location: { hash, pathname, search },
      history: { replaceState },
    } as unknown as Pick<Window, "history" | "location">,
    replaceState,
  };
}

describe("takeBackupKeyFromLocation", () => {
  it("returns the key and strips the fragment, keeping path and query", () => {
    const { win, replaceState } = fakeWindow("#k=3ABCDEFGHJKMNPQRSTVWXYZ012A", "/l/abc", "?x=1");
    expect(takeBackupKeyFromLocation(win)).toBe("3ABCDEFGHJKMNPQRSTVWXYZ012A");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/l/abc?x=1");
  });

  it("returns null and leaves the URL alone when there is no key", () => {
    const { win, replaceState } = fakeWindow("");
    expect(takeBackupKeyFromLocation(win)).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("ignores other fragments and does not strip them", () => {
    const { win, replaceState } = fakeWindow("#section-2");
    expect(takeBackupKeyFromLocation(win)).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
