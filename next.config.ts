import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Security headers live in a pure, server-safe module (no next/server import)
// so middleware and tests share one source of truth. Re-exported here so the
// header policy is discoverable from the app's central config.
export {
  buildSecurityHeaders,
  buildContentSecurityPolicy,
  STATIC_SECURITY_HEADERS,
} from "./src/lib/security-headers";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
