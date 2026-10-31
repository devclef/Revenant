/**
 * Security header values for Revenant (requirement R4.1).
 *
 * This module is a pure, server-safe source of truth for the static security
 * headers. It intentionally imports nothing from `next/server` (or any runtime
 * module) so it can be consumed by both the Edge middleware and Vitest without
 * pulling in framework internals or creating an import cycle.
 *
 * HSTS (Strict-Transport-Security) is deliberately NOT set here: it is
 * HTTPS-conditional and applied in `src/middleware.ts` based on the request
 * protocol.
 */

/**
 * Build the Content-Security-Policy value for a given per-request nonce.
 *
 * `'unsafe-inline'` appears in `style-src` ONLY. Next.js injects inline
 * `<style>` tags for its CSS runtime, so inline styles must be permitted.
 * Scripts are never allowed `'unsafe-inline'` or `'unsafe-eval'`; they are
 * gated on the per-request nonce instead.
 */
export function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // 'unsafe-inline' is required for STYLES only because Next.js injects
    // inline <style> tags; it is never applied to scripts.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Static security headers that do not depend on the request.
 *
 * Kept separate from the CSP so tests and middleware can assert them directly.
 */
export const STATIC_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/**
 * Build the full set of security headers for a request, given a per-request
 * script nonce. Returns the static headers plus the nonce-bearing CSP.
 *
 * Does NOT include HSTS; the middleware adds that only over HTTPS.
 */
export function buildSecurityHeaders(nonce: string): Record<string, string> {
  return {
    "Content-Security-Policy": buildContentSecurityPolicy(nonce),
    ...STATIC_SECURITY_HEADERS,
  };
}
