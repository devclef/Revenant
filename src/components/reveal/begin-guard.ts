// Feature: 07-judge-journey
//
// The once-per-`verified` guard for the Pick_Up_Button (design.md "Pick up and
// the status line", R10.6). A double click sends one BEGIN. The guard resets
// when the flow leaves `verified`, so a later `verified` can send BEGIN again.
// Pure, so the rule is testable without a DOM.

export type BeginGuard = {
  /** Sends BEGIN, unless one was already sent since the last reset. */
  begin: () => void;
  /** Re-arms the guard. Called when the flow leaves `verified`. */
  reset: () => void;
};

export function createBeginGuard(send: () => void): BeginGuard {
  let sent = false;
  return {
    begin() {
      if (sent) return;
      sent = true;
      send();
    },
    reset() {
      sent = false;
    },
  };
}
