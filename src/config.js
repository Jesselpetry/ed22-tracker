import os from "node:os";
import path from "node:path";

// KMITL tenant on the 2026 ED22 portal.
export const INSTITUTION_ID = "5232957";
export const COMMUNITY_VERSION = "136";
export const CANONICAL_DOMAIN = "ed22.engdis.com/thai";
export const DEFAULT_API_URL = "https://edwebservices2.engdis.com/api/";

// Local age cap for a cached token. The server may expire it sooner; a 401
// on the first request also clears it.
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function apiUrl() {
  return process.env.ED22_API_URL || DEFAULT_API_URL;
}

export function configDir() {
  if (process.env.ED22_CONFIG_DIR) return process.env.ED22_CONFIG_DIR;
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? os.homedir(), "ed22-tracker");
  }
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "ed22-tracker");
}
