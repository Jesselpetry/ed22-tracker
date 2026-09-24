import { useCallback, useEffect, useState } from "react";
import { readJson, writeJson } from "./storage.js";

const THEME_KEY = "ed22.theme";
const ORDER = ["auto", "light", "dark"];

// "auto" follows the OS; light/dark set data-theme on <html>.
export function useTheme() {
  const [theme, setTheme] = useState(() => (ORDER.includes(readJson(THEME_KEY)) ? readJson(THEME_KEY) : "auto"));

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") delete root.dataset.theme;
    else root.dataset.theme = theme;
    writeJson(THEME_KEY, theme);
  }, [theme]);

  const cycle = useCallback(() => {
    setTheme((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
  }, []);

  return { theme, cycle };
}
