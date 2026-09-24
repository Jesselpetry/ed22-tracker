import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LANGUAGES, translate } from "./strings.js";
import { readJson, writeJson } from "./storage.js";

const LANG_KEY = "ed22.lang";
const DAY_MS = 24 * 60 * 60 * 1000;
const I18nContext = createContext(null);

function initialLang() {
  const saved = readJson(LANG_KEY);
  if (LANGUAGES[saved]) return saved;
  return navigator.language?.toLowerCase().startsWith("th") ? "th" : "en";
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    writeJson(LANG_KEY, lang);
  }, [lang]);

  const value = useMemo(() => {
    const { locale } = LANGUAGES[lang];
    const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
    const times = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const t = (key, vars) => translate(lang, key, vars);

    return {
      lang,
      setLang,
      t,
      formatDate: (ms) => dates.format(ms),
      formatTime: (ms) => times.format(ms),
      // "now", "later today", "tomorrow", "in 3 days" (localized)
      formatDue: (due, now = Date.now()) => {
        if (due <= now) return t("dueNow");
        const days = Math.round((due - now) / DAY_MS);
        return days < 1 ? t("dueLaterToday") : relative.format(days, "day");
      },
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
