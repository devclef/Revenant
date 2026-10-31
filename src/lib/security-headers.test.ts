import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "./security-headers";

describe("buildSecurityHeaders", () => {
  const nonce = "dGVzdC1ub25jZS0xMjM0NTY3OA==";
  const headers = buildSecurityHeaders(nonce);
  const csp = headers["Content-Security-Policy"];

  it("sets a Content-Security-Policy header", () => {
    expect(csp).toBeTypeOf("string");
    expect(csp.length).toBeGreaterThan(0);
  });

  it("gates scripts on the per-request nonce and 'self'", () => {
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}'`);
  });

  it("sets default-src to 'self'", () => {
    expect(csp).toContain("default-src 'self'");
  });

  it("forbids framing with frame-ancestors 'none'", () => {
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("never allows 'unsafe-eval'", () => {
    expect(csp).not.toContain("unsafe-eval");
  });

  it("never allows 'unsafe-inline' for scripts", () => {
    const scriptSrc = csp
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith("script-src"));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("sets Referrer-Policy to no-referrer", () => {
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
  });

  it("sets X-Content-Type-Options to nosniff", () => {
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("disables camera, microphone and geolocation via Permissions-Policy", () => {
    const permissionsPolicy = headers["Permissions-Policy"];
    expect(permissionsPolicy).toContain("camera=()");
    expect(permissionsPolicy).toContain("microphone=()");
    expect(permissionsPolicy).toContain("geolocation=()");
  });

  it("does not include HSTS (that is HTTPS-conditional in middleware)", () => {
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });
});
