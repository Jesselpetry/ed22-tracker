import { useState } from "react";
import { Icon } from "../components/Icon.jsx";
import { Notice, Percent, ProgressBar, ProgressRing, useErrorText } from "../components/ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import { useI18n } from "../lib/i18n.jsx";
import { tone } from "../lib/progress.js";
import { href } from "../lib/router.js";
import { useToast } from "../lib/toast.jsx";

const STATUS_KEY = { done: "statusDone", none: "statusNotStarted", unknown: "statusUnknown", progress: "statusInProgress" };

export function Dashboard() {
  const { t, formatTime } = useI18n();
  const auth = useAuth();
  const toast = useToast();
  const errorText = useErrorText();
  const [refreshing, setRefreshing] = useState(false);

  const { overview, username, updatedAt } = auth;
  const doneUnits = overview.units.filter((u) => u.percent === 100).length;

  async function onRefresh() {
    setRefreshing(true);
    try {
      await auth.refresh();
      toast(t("refreshed"));
    } catch (err) {
      toast(errorText(err), { tone: "error" });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <section className="card hero">
        <ProgressRing percent={overview.percent} label={t("overallProgress")} />
        <div className="hero-body">
          <p className="eyebrow">{t("hello", { user: username })}</p>
          <h1 tabIndex={-1}>{t("overallProgress")}</h1>
          <p className="muted">
            {t("unitsComplete", { n: doneUnits, total: overview.units.length })}
            {overview.grade && <> · {t("grade")} <strong className="grade">{overview.grade}</strong></>}
          </p>
          <div className="button-row">
            <a className="button primary" href="#/pending">{t("seeWhatsLeft")}</a>
            <button type="button" className="button secondary" onClick={onRefresh} disabled={refreshing}>
              <Icon name="refresh" size={18} className={refreshing ? "spin" : ""} />
              {refreshing ? t("refreshing") : t("refresh")}
            </button>
          </div>
          <p className="hint">{t("updatedAt", { time: formatTime(updatedAt) })}</p>
        </div>
      </section>

      {auth.defaultPassword && (
        <Notice tone="warning" onDismiss={auth.dismissPasswordWarning}>
          <strong>{t("defaultPwTitle")}</strong> {t("defaultPwBody")}{" "}
          <a href="https://ed22.engdis.com/thai" target="_blank" rel="noopener noreferrer">ed22.engdis.com</a>
        </Notice>
      )}

      <h2 className="section-title">{t("units")}</h2>
      <ul className="unit-grid">
        {overview.units.map((unit, i) => (
          <li key={unit.nodeId}>
            <a className="card unit-card" href={href(`/unit/${unit.nodeId}`)}>
              <div className="unit-head">
                <span className="unit-index">{i + 1}</span>
                <span className="unit-name">{unit.name}</span>
                {unit.grade && <span className="badge">{unit.grade}</span>}
              </div>
              <ProgressBar percent={unit.percent} label={unit.name} />
              <div className="unit-foot">
                <Percent value={unit.percent} />
                <span className="muted">{t(STATUS_KEY[tone(unit.percent)])}</span>
                <Icon name="chevron" size={18} className="unit-arrow" />
              </div>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
