import { useEffect, useState } from "react";
import { EmptyState, Notice, PageHead, Percent, ProgressBar, StepChip, useErrorText } from "../components/ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import { useI18n } from "../lib/i18n.jsx";
import { href } from "../lib/router.js";

export function Pending() {
  const { t } = useI18n();
  const auth = useAuth();
  const errorText = useErrorText();
  const { loadAll } = auth;
  const total = auth.overview.units.length;

  const [state, setState] = useState({ status: "loading", done: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadAll((done) => !cancelled && setState({ status: "loading", done })).then(
      (results) => !cancelled && setState({ status: "ready", results }),
      (error) => !cancelled && setState({ status: "error", error }),
    );
    return () => {
      cancelled = true;
    };
  }, [loadAll, attempt]);

  const back = { href: "#/", label: t("allUnits") };

  if (state.status === "loading") {
    const percent = total ? Math.round((state.done / total) * 100) : 0;
    return (
      <>
        <PageHead title={t("pendingTitle")} back={back} />
        <div className="card loading-card" aria-live="polite">
          <p>{t("loadingUnits", { n: state.done, total })}</p>
          <ProgressBar percent={percent} label={t("loading")} />
        </div>
      </>
    );
  }

  if (state.status === "error") {
    return (
      <>
        <PageHead title={t("pendingTitle")} back={back} />
        <Notice tone="error">
          {errorText(state.error)}{" "}
          <button type="button" className="link-button" onClick={() => {
            setState({ status: "loading", done: 0 });
            setAttempt((a) => a + 1);
          }}>
            {t("tryAgain")}
          </button>
        </Notice>
      </>
    );
  }

  const groups = state.results
    .map(({ unit, lessons }) => ({ unit, lessons: lessons.filter((l) => l.pending) }))
    .filter((g) => g.lessons.length > 0);
  const count = groups.reduce((sum, g) => sum + g.lessons.length, 0);

  return (
    <>
      <PageHead title={t("pendingTitle")} back={back}>
        {count > 0 && <p className="muted">{t("pendingSummary", { n: count, units: groups.length })}</p>}
      </PageHead>

      {count === 0 ? (
        <EmptyState title={t("allDoneTitle")}>
          <p className="muted">{t("allDoneBody")}</p>
        </EmptyState>
      ) : (
        groups.map(({ unit, lessons }) => (
          <section key={unit.nodeId} className="pending-group">
            <h2 className="section-title">
              <a href={href(`/unit/${unit.nodeId}`)}>{unit.name}</a>
            </h2>
            <ul className="lesson-list">
              {lessons.map((lesson) => (
                <li key={lesson.nodeId} className="card lesson">
                  <div className="lesson-head">
                    <h3 className="lesson-name">{lesson.name}</h3>
                    <Percent value={lesson.percent} />
                  </div>
                  <div className="chips">
                    {lesson.steps.filter((s) => s.percent !== 100).map((step) => <StepChip key={step.name} step={step} />)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
