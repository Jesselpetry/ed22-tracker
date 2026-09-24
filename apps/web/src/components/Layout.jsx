import { useAuth } from "../lib/auth.jsx";
import { useI18n } from "../lib/i18n.jsx";
import { useTheme } from "../lib/theme.js";
import { useToast } from "../lib/toast.jsx";
import { Icon } from "./Icon.jsx";

const REPO_URL = "https://github.com/Jesselpetry/ed22-tracker";
const UPSTREAM_URL = "https://github.com/BossNz/auto-english-discovery";
const THEME_ICON = { auto: "auto", light: "sun", dark: "moon" };

function focusMain() {
  document.getElementById("main")?.focus();
}

export function Layout({ section, children }) {
  const { t, lang, setLang } = useI18n();
  const { theme, cycle } = useTheme();
  const auth = useAuth();
  const toast = useToast();

  async function onSignOut() {
    await auth.signOut();
    toast(t("signedOut"));
  }

  return (
    <div className="app">
      <button type="button" className="skip-link" onClick={focusMain}>{t("skipToContent")}</button>

      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/" aria-label="ED22 Tracker">
            <img src="./favicon.svg" alt="" width="28" height="28" />
            <span className="brand-name">ED22 Tracker</span>
          </a>

          <nav className="tabs" aria-label={t("mainNav")}>
            <a href="#/" aria-current={section === "progress" ? "page" : undefined}>
              <Icon name="chart" size={18} />
              {t("navProgress")}
            </a>
            <a href="#/study" aria-current={section === "study" ? "page" : undefined}>
              <Icon name="cards" size={18} />
              {t("navStudy")}
            </a>
          </nav>

          <div className="topbar-actions">
            <button
              type="button"
              className="icon-button text"
              onClick={() => setLang(lang === "th" ? "en" : "th")}
              aria-label={t("switchLanguage")}
              title={t("switchLanguage")}
            >
              {lang === "th" ? "EN" : "ไทย"}
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={cycle}
              aria-label={t("themeButton", { theme: t(`theme_${theme}`) })}
              title={t("themeButton", { theme: t(`theme_${theme}`) })}
            >
              <Icon name={THEME_ICON[theme]} />
            </button>
            {auth.status === "ready" && (
              <button
                type="button"
                className="icon-button"
                onClick={onSignOut}
                aria-label={t("signOutAs", { user: auth.username })}
                title={t("signOutAs", { user: auth.username })}
              >
                <Icon name="logout" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <div className="container">{children}</div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>{t("footerDisclaimer")}</p>
          <p>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">{t("footerSource")}</a>
            {" · GPL-3.0 · "}
            {t("footerCredits")}{" "}
            <a href={UPSTREAM_URL} target="_blank" rel="noopener noreferrer">BossNz/auto-english-discovery</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
