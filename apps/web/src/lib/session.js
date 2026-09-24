import { createClient, DEFAULT_API_URL, SESSION_MAX_AGE_MS } from "@ed22/core";
import { readJson, remove, writeJson } from "./storage.js";

export const API_URL = import.meta.env.VITE_ED22_API_URL || DEFAULT_API_URL;
export const baseClient = createClient({ baseUrl: API_URL });

const SESSION_KEY = "ed22.session";
const LAST_USER_KEY = "ed22.lastUser";

// Only { username, token, savedAt } is stored; never the password. By default
// it lives in sessionStorage (this tab only). "Remember me" uses localStorage.
export function loadSession({ now = Date.now() } = {}) {
  const saved = readJson(SESSION_KEY, { session: true }) ?? readJson(SESSION_KEY);
  const valid = typeof saved?.token === "string"
    && typeof saved.username === "string"
    && Number.isFinite(saved.savedAt);
  if (!valid) return null;
  if (now - saved.savedAt > SESSION_MAX_AGE_MS) {
    clearSession();
    return null;
  }
  return saved;
}

export function saveSession({ username, token }, { remember }) {
  clearSession();
  writeJson(SESSION_KEY, { username, token, savedAt: Date.now() }, { session: !remember });
  if (remember) writeJson(LAST_USER_KEY, username);
  else remove(LAST_USER_KEY);
}

export function clearSession() {
  remove(SESSION_KEY);
}

export function lastUsername() {
  return readJson(LAST_USER_KEY) ?? "";
}
