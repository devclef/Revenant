// Download for the data-source adapters (04-real-figures).
//
// This is the one place that applies R2: it refuses a host outside the allowed
// set before sending, re-checks the final URL's host after redirects, and maps
// every HTTP and transport outcome onto a SourceError with a fixed, neutral
// message. It sets no header, credential or cookie, reads no environment
// variable, and never logs. Nothing outside src/lib/sources imports this folder
// (enforced by boundary.test.ts, R6.7).

import { SourceError, type SourcePublisher } from "./errors";
import type { FetchResult, Fetcher } from "./types";

// Re-exported so callers can take the download types from this module too.
export type { FetchResult, Fetcher } from "./types";

/** The only hosts a download may reach, before and after redirects (R2.5). */
export const ALLOWED_HOSTS = ["www.eia.gov", "energy.ec.europa.eu"] as const;

/** How long a single download may run before it is abandoned (R2). */
const TIMEOUT_MS = 60_000;

/** The largest body we will read. Anything larger is treated as unreadable. */
const MAX_BODY_BYTES = 20 * 1024 * 1024;

/** True when `host` is one of the allowed publisher hosts. */
function isAllowedHost(host: string): boolean {
  return (ALLOWED_HOSTS as readonly string[]).includes(host);
}

/**
 * The real downloader: global `fetch`, following redirects, with a 60 s
 * timeout. It sets no headers, sends no credentials or cookies, and reads no
 * environment variable. Tests pass their own `Fetcher` instead (R2.6), so this
 * is never exercised by the suite.
 */
export const defaultFetcher: Fetcher = async (url: string): Promise<FetchResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      credentials: "omit",
      signal: controller.signal,
    });
    const buffer = await response.arrayBuffer();
    return {
      status: response.status,
      url: response.url,
      body: new Uint8Array(buffer),
    };
  } finally {
    clearTimeout(timer);
  }
};

/** The host of a URL, or null if it cannot be parsed. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Download one URL for a publisher, applying R2 exactly.
 *
 * - The requested URL's host must be in `ALLOWED_HOSTS`, checked before the
 *   fetcher is called; otherwise `wrong_host`.
 * - After the fetcher returns, the final URL's host must also be allowed
 *   (redirects can move it); otherwise `wrong_host`.
 * - `401`, `403`, `407` -> `auth_required` (message names publisher and status).
 * - Any other non-2xx -> `http_status`.
 * - The fetcher throwing (network error, timeout) -> `network` (message names
 *   publisher and URL, never the underlying library's message).
 * - A zero-byte body -> `empty_body`.
 * - A body over 20 MB -> `unreadable_file`.
 *
 * On success it returns the raw bytes with the final URL and status.
 */
export async function download(
  fetcher: Fetcher,
  url: string,
  publisher: SourcePublisher,
): Promise<FetchResult> {
  const requestHost = hostOf(url);
  if (requestHost === null || !isAllowedHost(requestHost)) {
    throw new SourceError(publisher, "wrong_host", { url });
  }

  let result: FetchResult;
  try {
    result = await fetcher(url);
  } catch {
    // The underlying message may carry a host, path or library detail we do not
    // want in a neutral error, so it is deliberately discarded.
    throw new SourceError(publisher, "network", { url });
  }

  const finalHost = hostOf(result.url);
  if (finalHost === null || !isAllowedHost(finalHost)) {
    throw new SourceError(publisher, "wrong_host", { url: result.url });
  }

  if (
    result.status === 401 ||
    result.status === 403 ||
    result.status === 407
  ) {
    throw new SourceError(publisher, "auth_required", {
      url: result.url,
      status: result.status,
    });
  }

  if (result.status < 200 || result.status >= 300) {
    throw new SourceError(publisher, "http_status", {
      url: result.url,
      status: result.status,
    });
  }

  if (result.body.byteLength === 0) {
    throw new SourceError(publisher, "empty_body", { url: result.url });
  }

  if (result.body.byteLength > MAX_BODY_BYTES) {
    throw new SourceError(publisher, "unreadable_file", { url: result.url });
  }

  return result;
}
