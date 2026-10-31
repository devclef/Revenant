import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { buildSecurityHeaders } from "@/lib/security-headers";

/**
 * Generate a fresh base64 nonce for this request.
 *
 * The Edge runtime has no Node `crypto` module, so we use the Web Crypto API
 * (`crypto.getRandomValues`) over 16 random bytes and base64-encode them. A new
 * nonce per request is what lets the CSP gate inline bootstrap scripts without
 * `'unsafe-inline'`.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // btoa is available in the Edge runtime; build a binary string from the bytes.
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function middleware(request: NextRequest): NextResponse {
  const nonce = generateNonce();

  // Forward the nonce to server components / the document on a request header
  // so inline bootstrap scripts can carry the matching `nonce` attribute.
  const securityHeaders = buildSecurityHeaders(nonce);
  const contentSecurityPolicy = securityHeaders["Content-Security-Policy"];

  // Forward the nonce AND the CSP on the request headers. Next.js's App Router
  // reads the request's `Content-Security-Policy` header, extracts the
  // `script-src` nonce, and stamps that nonce onto every inline bootstrap
  // script it emits (the `self.__next_f.push(...)` flight-data scripts). Without
  // the CSP on the request, those inline scripts ship with no nonce and the
  // browser blocks them, producing CSP console errors. `x-nonce` is kept so
  // server components can read the nonce directly if needed.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Attach the shared security headers (CSP built with this request's nonce).
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }

  // HSTS is sent ONLY over HTTPS. Behind the TLS-terminating ingress the request
  // reaches this app over HTTP, so trust the x-forwarded-proto header as well as
  // the request's own protocol.
  const isHttps =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  if (isHttps) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000",
    );
  }

  return response;
}

export const config = {
  // Run on every route except Next's static assets. The negative lookahead
  // excludes only _next/static, _next/image and favicon.ico, so both `/` and
  // the `/api/health` route handler match and receive the R4.1 headers.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
