// Backup key fragment: read the key from a `#k=` URL fragment and remove the
// fragment from the address bar.
//
// The fragment never reaches the server (browsers do not send it), so the key
// stays in the browser. `LiveLetter` reads it and strips it in a mount effect
// before any request starts (design.md Part D, R21.6).
//
// Browser-only. Imports nothing from the server.

const KEY_PARAM = "k=";

/**
 * Return the key text from a `#k=...` fragment, or null when the hash has no
 * `k=` parameter or its value is empty. Other fragment parameters are ignored.
 */
export function readKeyFragment(hash: string): string | null {
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const part of body.split("&")) {
    if (part.startsWith(KEY_PARAM)) {
      const value = part.slice(KEY_PARAM.length);
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

/**
 * Remove the fragment from the current URL without a new history entry. The
 * path and query stay the same.
 */
export function stripFragment(win: Pick<Window, "history" | "location">): void {
  const { pathname, search } = win.location;
  win.history.replaceState(null, "", pathname + search);
}

/**
 * Read the backup key from the current URL and strip it from the address bar.
 * Returns the key text, or null when the URL has no key. The fragment is
 * removed only when it held a key, so other fragments are left alone.
 *
 * `LiveLetter` calls this once, in its mount effect, before it renders the
 * opening flow.
 */
export function takeBackupKeyFromLocation(
  win: Pick<Window, "history" | "location">,
): string | null {
  const key = readKeyFragment(win.location.hash);
  if (key !== null) {
    stripFragment(win);
  }
  return key;
}
