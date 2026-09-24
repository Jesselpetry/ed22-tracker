import { useEffect, useState } from "react";
import { EmptyState, Notice, PageHead, Percent, ProgressBar, Skeleton, StepChip, useErrorText } from "../components/ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import { useI18n } from "../lib/i18n.jsx";

export function Unit({ id }) {
  const { t } = useI18n();
  const auth = useAuth();
  const errorText = useErrorText();
  const unit = auth.overview.units.find((u) => String(u.nodeId) === id);

  const [state, setState] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState("all");
  const { loadUnit } = auth;

  useEffect(() => {
    if (!unit) return undefined;
    let cancelled = false;
    loadUnit(unit).then(
      (lessons) => !cancelled && setState({ status: "ready", lessons }),
      (error) => !cancelled && setState({ status: "error", error }),
    );
    return () => {
      cancelled = true;
    };
  }, [unit, loadUnit, attempt]);

  const back = { href: "#/", label: t("allUnits") };
  if (!unit) {
    return (
      <>
        <PageHead title={t("unitNotFound")} back={back} />
        <p className="muted">{t("unitNotFoundBody")}</p>
      </>
    );
  }

  const lessons = state.lessons ?? [];
  const pending = lessons.filter((l) => l.pending);
  const shown = filter === "todo" ? pending : lessons;

  return (
    <>
      <PageHead title={unit.name} back={back}>
        <div className="page-meta">
          <Percent value={unit.percent} />
          {state.status === "ready" && (
            <span className="muted">{t("lessonsComplete", { n: lessons.length - pending.length, total: lessons.length })}</span>
          )}
        </div>
        <ProgressBar percent={unit.percent} label={unit.name} large />
      </PageHead>

      {state.status === "loading" && <Skeleton lines={4} />}

      {state.status === "error" && (
        <Notice tone="error">
          {errorText(state.error)}{" "}
          <button type="button" className="link-button" onClick={() => {
            setState({ status: "loading" });
            setAttempt((a) => a + 1);
          }}>
            {t("tryAgain")}
          </button>
        </Notice>
      )}

      {state.status === "ready" && (
        <>
          <div className="segmented" role="group" aria-label={t("filterLessons")}>
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              {t("filterAll")} <span className="count">{lessons.length}</span>
            </button>
            <button type="button" aria-pressed={filter === "todo"} onClick={() => setFilter("todo")}>
              {t("filterTodo")} <span className="count">{pending.length}</span>
            </button>
          </div>

          {shown.length === 0 ? (
            <EmptyState title={t("unitAllDone")}>
              <p className="muted">{t("unitAllDoneBody")}</p>
            </EmptyState>
          ) : (
            <ul className="lesson-list">
              {shown.map((lesson) => (
                <li key={lesson.nodeId} className={`card lesson ${lesson.pending ? "" : "is-done"}`}>
                  <div className="lesson-head">
                    <h3 className="lesson-name">{lesson.name}</h3>
                    <Percent value={lesson.percent} />
                  </div>
                  <div className="chips">
                    {lesson.steps.map((step) => <StepChip key={step.name} step={step} />)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
