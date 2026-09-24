import { useState } from "react";
import { Icon } from "../components/Icon.jsx";
import { Notice, useErrorText } from "../components/ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import { useI18n } from "../lib/i18n.jsx";
import { lastUsername } from "../lib/session.js";

const REPO_URL = "https://github.com/Jesselpetry/ed22-tracker";
const STUDENT_ID = /^\d{8}$/;

export function Login() {
  const { t } = useI18n();
  const auth = useAuth();
  const errorText = useErrorText();

  const [username, setUsername] = useState(lastUsername);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => Boolean(lastUsername()));
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const idInvalid = touched && !STUDENT_ID.test(username.trim());

  async function onSubmit(event) {
    event.preventDefault();
    setTouched(true);
    if (!STUDENT_ID.test(username.trim())) return;
    if (!password) {
      setError(t("errPasswordRequired"));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await auth.signIn({ username: username.trim(), password, remember });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <div className="login-layout">
      <section className="card login-card">
        <h1 tabIndex={-1}>{t("signInTitle")}</h1>
        <p className="muted">{t("signInSubtitle")}</p>

        {auth.expired && !error && <Notice>{t("sessionExpired")}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        <form className="form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="student-id">{t("studentId")}</label>
            <input
              id="student-id"
              name="username"
              inputMode="numeric"
              autoComplete="username"
              maxLength={8}
              placeholder="67xxxxxx"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\D/g, ""))}
              onBlur={() => username && setTouched(true)}
              aria-invalid={idInvalid}
              aria-describedby={idInvalid ? "student-id-error" : undefined}
              required
            />
            {idInvalid && <p id="student-id-error" className="field-error">{t("errStudentId")}</p>}
          </div>

          <div className="field">
            <label htmlFor="password">{t("password")}</label>
            <div className="input-group">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="input-addon"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                <Icon name="eye" size={18} />
              </button>
            </div>
          </div>

          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>
              {t("rememberMe")}
              <small>{t("rememberHint")}</small>
            </span>
          </label>

          <button className="button primary block" type="submit" disabled={busy}>
            {busy ? t("signingIn") : t("signIn")}
          </button>
          <p className="hint">{t("forceLoginHint")}</p>
        </form>
      </section>

      <aside className="card privacy" aria-labelledby="privacy-title">
        <h2 id="privacy-title">{t("privacyTitle")}</h2>
        <ul className="feature-list">
          <li><Icon name="lock" /><span>{t("privacyDirect")}</span></li>
          <li><Icon name="shield" /><span>{t("privacyNoServer")}</span></li>
          <li><Icon name="eye" /><span>{t("privacyReadOnly")}</span></li>
          <li>
            <Icon name="code" />
            <span>
              {t("privacyOpenSource")}{" "}
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
            </span>
          </li>
        </ul>
        <a className="button secondary block" href="#/study">
          <Icon name="cards" size={18} />
          {t("studyWithoutSignIn")}
        </a>
      </aside>
    </div>
  );
}
