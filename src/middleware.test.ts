import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "./middleware";

/**
 * Behaviour tests for the security-headers middleware.
 *
 * The middleware builds the CSP with a per-request nonce, always sets the
 * static R4.1 headers, and sends HSTS only over HTTPS. These tests invoke it
 * with constructed NextRequests and assert the resulting response headers.
 */

/** Headers from R4.1 that must appear on every response, HTTPS or not. */
const ALWAYS_PRESENT_HEADERS = [
  "Content-Security-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "Permissions-Policy",
] as const;

describe("middleware security headers", () => {
  describe("over HTTPS", () => {
    for (const path of ["/", "/api/health"]) {
      describe(`request to ${path}`, () => {
        const response = middleware(
          new NextRequest(`https://revenant.devclef.se${path}`),
        );

        it("sets a Content-Security-Policy with a script-src nonce token", () => {
          const csp = response.headers.get("Content-Security-Policy");
          expect(csp).toBeTypeOf("string");
          expect(csp).toMatch(/script-src [^;]*'nonce-[^']+'/);
        });

        it("never allows unsafe-eval or unsafe-inline for scripts", () => {
          const csp = response.headers.get("Content-Security-Policy") ?? "";
          expect(csp).not.toContain("unsafe-eval");
          const scriptSrc = csp
            .split(";")
            .map((directive) => directive.trim())
            .find((directive) => directive.startsWith("script-src"));
          expect(scriptSrc).toBeDefined();
          expect(scriptSrc).not.toContain("unsafe-inline");
        });

        it("sends Strict-Transport-Security: max-age=31536000", () => {
          expect(response.headers.get("Strict-Transport-Security")).toBe(
            "max-age=31536000",
          );
        });

        it("sets every other R4.1 header", () => {
          for (const header of ALWAYS_PRESENT_HEADERS) {
            expect(response.headers.get(header)).toBeTruthy();
          }
          expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
          expect(response.headers.get("X-Content-Type-Options")).toBe(
            "nosniff",
          );
          const permissionsPolicy =
            response.headers.get("Permissions-Policy") ?? "";
          expect(permissionsPolicy).toContain("camera=()");
          expect(permissionsPolicy).toContain("microphone=()");
          expect(permissionsPolicy).toContain("geolocation=()");
        });
      });
    }

    it("honours x-forwarded-proto: https behind a TLS-terminating ingress", () => {
      const response = middleware(
        new NextRequest("http://revenant.devclef.se/", {
          headers: { "x-forwarded-proto": "https" },
        }),
      );
      expect(response.headers.get("Strict-Transport-Security")).toBe(
        "max-age=31536000",
      );
    });

    it("issues a fresh nonce per request", () => {
      const extractNonce = (response: ReturnType<typeof middleware>): string => {
        const csp = response.headers.get("Content-Security-Policy") ?? "";
        const match = csp.match(/'nonce-([^']+)'/);
        expect(match).not.toBeNull();
        return match![1];
      };
      const first = extractNonce(
        middleware(new NextRequest("https://revenant.devclef.se/")),
      );
      const second = extractNonce(
        middleware(new NextRequest("https://revenant.devclef.se/")),
      );
      expect(first).not.toBe(second);
    });
  });

  describe("over plain HTTP (no x-forwarded-proto: https)", () => {
    const response = middleware(new NextRequest("http://revenant.devclef.se/"));

    it("does not send Strict-Transport-Security", () => {
      expect(response.headers.get("Strict-Transport-Security")).toBeNull();
    });

    it("still sets every other R4.1 header", () => {
      for (const header of ALWAYS_PRESENT_HEADERS) {
        expect(response.headers.get(header)).toBeTruthy();
      }
      const csp = response.headers.get("Content-Security-Policy") ?? "";
      expect(csp).toMatch(/script-src [^;]*'nonce-[^']+'/);
      expect(csp).not.toContain("unsafe-eval");
    });
  });
});
