import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { configDir, SESSION_MAX_AGE_MS } from "../config.js";

// Stores only { username, token, savedAt }. The password is never persisted.
function sessionPath() {
  return path.join(configDir(), "session.json");
}

export async function loadSession({ now = Date.now() } = {}) {
  let raw;
  try {
    raw = await readFile(sessionPath(), "utf8");
  } catch {
    return null;
  }

  let session;
  try {
    session = JSON.parse(raw);
  } catch {
    return null;
  }

  const valid = typeof session?.username === "string"
    && typeof session.token === "string"
    && Number.isFinite(session.savedAt);
  if (!valid) return null;

  return { ...session, expired: now - session.savedAt > SESSION_MAX_AGE_MS };
}

export async function saveSession({ username, token }, { now = Date.now() } = {}) {
  const dir = configDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });

  const file = sessionPath();
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ username, token, savedAt: now }), { mode: 0o600 });
  await rename(tmp, file);
  // writeFile's mode is ignored for an existing file and is subject to umask.
  await chmod(file, 0o600);
}

export async function clearSession() {
  await rm(sessionPath(), { force: true });
}
