import pkg from "../../package.json";

/**
 * The application version.
 *
 * Resolves from the `APP_VERSION` environment variable when set (e.g. injected
 * at build or deploy time), otherwise falls back to the `version` field of
 * `package.json`.
 */
export function getVersion(): string {
  const fromEnv = process.env.APP_VERSION;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  return pkg.version;
}

export const APP_VERSION = getVersion();
