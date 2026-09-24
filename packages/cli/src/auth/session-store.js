import { rm } from "node:fs/promises";
import { SESSION_MAX_AGE_MS } from "@ed22/core";
import { configFile, readConfigText, writeConfigFile } from "../storage.js";

// Stores only { username, token, savedAt }. The password is never persisted.
const SESSION_FILE = "session.json";

export async function loadSession({ now = Date.now() } = {}) {
  let session;
  try {
    session = JSON.parse(await readConfigText(SESSION_FILE));
  } catch {
    // Unreadable or corrupt: a session is disposable, just sign in again.
    return null;
  }

  const valid = typeof session?.username === "string"
    && typeof session.token === "string"
    && Number.isFinite(session.savedAt);
  if (!valid) return null;

  return { ...session, expired: now - session.savedAt > SESSION_MAX_AGE_MS };
}

export async function saveSession({ username, token }, { now = Date.now() } = {}) {
  await writeConfigFile(SESSION_FILE, JSON.stringify({ username, token, savedAt: now }));
}

export async function clearSession() {
  await rm(configFile(SESSION_FILE), { force: true });
}
