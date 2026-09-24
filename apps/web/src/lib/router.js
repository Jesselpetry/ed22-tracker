import { useEffect, useState } from "react";

// Hash routing: no server rewrites needed, so any static host works.
function currentPath() {
  return window.location.hash.replace(/^#/, "") || "/";
}

export function useRoute() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}

export function navigate(path) {
  window.location.hash = path;
}

export function href(path) {
  return `#${path}`;
}

// match("/unit/42", "/unit/:id") -> { id: "42" }; null when it does not match.
export function match(path, pattern) {
  const actual = path.split("/").filter(Boolean);
  const expected = pattern.split("/").filter(Boolean);
  if (actual.length !== expected.length) return null;

  const params = {};
  for (let i = 0; i < expected.length; i++) {
    if (expected[i].startsWith(":")) {
      params[expected[i].slice(1)] = decodeURIComponent(actual[i]);
    } else if (expected[i] !== actual[i]) {
      return null;
    }
  }
  return params;
}
