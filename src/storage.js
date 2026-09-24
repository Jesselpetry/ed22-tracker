import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { configDir } from "./config.js";

export function configFile(name) {
  return path.join(configDir(), name);
}

// Returns null when the file does not exist; other errors propagate so callers
// never mistake an unreadable file for an empty one and overwrite it.
export async function readConfigText(name) {
  try {
    return await readFile(configFile(name), "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

// Write-then-rename so a crash mid-write never leaves a truncated file.
export async function writeConfigFile(name, text, { mode = 0o600 } = {}) {
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
  const file = configFile(name);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, text, { mode });
  await rename(tmp, file);
  // writeFile's mode is ignored for an existing file and is subject to umask.
  await chmod(file, mode);
}
