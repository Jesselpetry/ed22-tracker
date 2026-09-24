// Browser storage can throw (private mode, blocked site data, quota), so every
// access is wrapped. The app must keep working with storage unavailable.

function area(session) {
  return session ? window.sessionStorage : window.localStorage;
}

export function readText(key, { session = false } = {}) {
  try {
    return area(session).getItem(key);
  } catch {
    return null;
  }
}

export function readJson(key, options) {
  try {
    return JSON.parse(readText(key, options));
  } catch {
    return null;
  }
}

export function writeJson(key, value, { session = false } = {}) {
  try {
    area(session).setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  for (const session of [false, true]) {
    try {
      area(session).removeItem(key);
    } catch {
      // Nothing stored, or storage blocked: either way it is gone.
    }
  }
}
