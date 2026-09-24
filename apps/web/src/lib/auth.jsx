import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  getOverview,
  getUnitTree,
  login,
  logout,
  normalizeLessons,
  normalizeOverview,
  usesDefaultPassword,
} from "@ed22/core";
import { baseClient, clearSession, loadSession, saveSession } from "./session.js";
import { saveCourse } from "./study-store.js";

const AuthContext = createContext(null);

// Checks a saved token against ED22 and returns the resulting auth state.
async function restoreSession(saved) {
  const client = baseClient.withToken(saved.token);
  try {
    const tree = await getOverview(client);
    return {
      status: "ready",
      client,
      username: saved.username,
      overview: normalizeOverview(tree),
      updatedAt: Date.now(),
    };
  } catch (err) {
    if (err instanceof ApiError && err.isAuthError) {
      clearSession();
      return { status: "anonymous", expired: true };
    }
    return { status: "offline", error: err };
  }
}

// status: "anonymous" | "restoring" | "ready" | "offline" (saved session, but ED22 unreachable)
export function AuthProvider({ children }) {
  const [state, setState] = useState(() => (loadSession() ? { status: "restoring" } : { status: "anonymous" }));
  const lessonCache = useRef(new Map());

  useEffect(() => {
    const saved = loadSession();
    if (!saved) return undefined;
    let cancelled = false;
    restoreSession(saved).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = useCallback(async () => {
    const saved = loadSession();
    if (!saved) {
      setState({ status: "anonymous" });
      return;
    }
    setState({ status: "restoring" });
    setState(await restoreSession(saved));
  }, []);

  const expire = useCallback(() => {
    clearSession();
    lessonCache.current.clear();
    setState({ status: "anonymous", expired: true });
  }, []);

  // A 401/403 from any request means the token is dead: drop back to sign-in.
  const guard = useCallback(async (request) => {
    try {
      return await request();
    } catch (err) {
      if (err instanceof ApiError && err.isAuthError) expire();
      throw err;
    }
  }, [expire]);

  const signIn = useCallback(async ({ username, password, remember }) => {
    const token = await login(baseClient, { username, password });
    const client = baseClient.withToken(token);
    saveSession({ username, token }, { remember });
    const tree = await getOverview(client);
    lessonCache.current.clear();
    setState({
      status: "ready",
      client,
      username,
      overview: normalizeOverview(tree),
      updatedAt: Date.now(),
      defaultPassword: usesDefaultPassword(username, password),
    });
  }, []);

  const { client, overview } = state;

  const signOut = useCallback(async () => {
    if (client) {
      try {
        await logout(client);
      } catch {
        // Token may already be dead server-side; clearing locally is what matters.
      }
    }
    clearSession();
    lessonCache.current.clear();
    setState({ status: "anonymous" });
  }, [client]);

  const refresh = useCallback(() => guard(async () => {
    const tree = await getOverview(client);
    lessonCache.current.clear();
    setState((s) => ({ ...s, overview: normalizeOverview(tree), updatedAt: Date.now() }));
  }), [client, guard]);

  const loadUnit = useCallback((unit) => guard(async () => {
    if (!lessonCache.current.has(unit.nodeId)) {
      const raw = await getUnitTree(client, unit);
      lessonCache.current.set(unit.nodeId, normalizeLessons(raw));
    }
    return lessonCache.current.get(unit.nodeId);
  }), [client, guard]);

  // Loads every unit (reporting progress) and refreshes the offline lesson list.
  const loadAll = useCallback(async (onProgress) => {
    const results = [];
    for (const unit of overview.units) {
      results.push({ unit, lessons: await loadUnit(unit) });
      onProgress?.(results.length, overview.units.length);
    }
    saveCourse(overview, results);
    return results;
  }, [overview, loadUnit]);

  const dismissPasswordWarning = useCallback(() => {
    setState((s) => ({ ...s, defaultPassword: false }));
  }, []);

  const value = useMemo(() => ({
    ...state,
    signIn,
    signOut,
    retry,
    refresh,
    loadUnit,
    loadAll,
    dismissPasswordWarning,
  }), [state, signIn, signOut, retry, refresh, loadUnit, loadAll, dismissPasswordWarning]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
