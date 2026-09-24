import os from "node:os";
import path from "node:path";
import { DEFAULT_API_URL } from "@ed22/core";

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
