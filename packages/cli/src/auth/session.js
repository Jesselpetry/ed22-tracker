import { ApiError, getOverview, login, logout, usesDefaultPassword } from "@ed22/core";
import { getCredentials } from "./credentials.js";
import { clearSession, loadSession, saveSession } from "./session-store.js";

// Returns an authenticated client plus the first overview fetch, which doubles
// as the token check. Reusing a cached token avoids ForceLogin, which would
// otherwise kick an open browser session.
export async function authenticate(baseClient, { fresh, save, interactive, onStatus, onWarning }) {
  const cached = fresh ? null : await loadSession();

  if (cached && !cached.expired) {
    const client = baseClient.withToken(cached.token);
    onStatus?.("Checking saved session…");
    try {
      const overview = await getOverview(client);
      return { client, overview, username: cached.username, reused: true };
    } catch (err) {
      if (!(err instanceof ApiError && err.isAuthError)) throw err;
    }
  }
  if (cached) await clearSession();

  const creds = await getCredentials({ interactive, defaultUsername: cached?.username });
  if (usesDefaultPassword(creds.username, creds.password)) {
    onWarning?.(
      "You are using the default password (last 5 digits of your student ID). "
      + "Anyone who knows your ID can sign in as you. Change it on ed22.engdis.com.",
    );
  }

  onStatus?.("Signing in…");
  const token = await login(baseClient, creds);
  const client = baseClient.withToken(token);
  if (save) await saveSession({ username: creds.username, token });

  onStatus?.("Loading progress…");
  const overview = await getOverview(client);
  return { client, overview, username: creds.username, reused: false };
}

// `activeClient` covers --no-save runs, where the token only lives in memory.
export async function signOut(baseClient, activeClient) {
  const cached = await loadSession();
  const client = activeClient ?? (cached && baseClient.withToken(cached.token));
  if (client) {
    try {
      await logout(client);
    } catch {
      // Token may already be dead server-side; clearing locally is what matters.
    }
  }
  await clearSession();
  return Boolean(client);
}
