import { useI18n } from "../lib/i18n.jsx";
import { tone } from "../lib/progress.js";
import { Icon } from "./Icon.jsx";

export function Percent({ value }) {
  return <span className={`percent tone-${tone(value)}`}>{value === null ? "?" : `${value}%`}</span>;
}

// Same rule as the numbers: a started bar is never empty, an unfinished one never full.
function visualWidth(percent) {
  if (percent === null) return 0;
  if (percent >= 100) return 100;
  if (percent <= 0) return 0;
  return Math.min(97, Math.max(3, percent));
}

export function ProgressBar({ percent, label, large = false }) {
  return (
    <div
      className={`bar tone-${tone(percent)} ${large ? "large" : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
    >
      <div className="bar-fill" style={{ width: `${visualWidth(percent)}%` }} />
    </div>
  );
}

export function ProgressRing({ percent, label, size = 128 }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (visualWidth(percent) / 100) * circumference;
  return (
    <div className={`ring tone-${tone(percent)}`} role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-label">{percent === null ? "?" : `${percent}%`}</span>
    </div>
  );
}

export function StepChip({ step }) {
  const { t } = useI18n();
  const state = tone(step.percent);
  let detail;
  if (state === "done") detail = <Icon name="check" size={14} />;
  else if (step.done !== null && step.total > 0) detail = `${step.done}/${step.total}`;
  else detail = step.percent === null ? "?" : `${step.percent}%`;

  const label = state === "done" ? t("stepDone", { step: step.name }) : t("stepProgress", { step: step.name });
  return (
    <span className={`chip tone-${state} ${step.isTest ? "is-test" : ""}`} title={label}>
      <span>{step.name}</span>
      <span className="chip-detail">{detail}</span>
    </span>
  );
}

export function Notice({ tone: noticeTone = "info", children, onDismiss }) {
  const { t } = useI18n();
  const icon = noticeTone === "error" || noticeTone === "warning" ? "alert" : "info";
  return (
    <div className={`notice tone-${noticeTone}`} role={noticeTone === "error" ? "alert" : "status"}>
      <Icon name={icon} />
      <div className="notice-body">{children}</div>
      {onDismiss && (
        <button type="button" className="icon-button small" aria-label={t("close")} onClick={onDismiss}>
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

export function Skeleton({ lines = 3 }) {
  const { t } = useI18n();
  return (
    <div className="skeleton-list" aria-busy="true" aria-label={t("loading")}>
      {Array.from({ length: lines }, (_, i) => <div key={i} className="card skeleton" />)}
    </div>
  );
}

export function EmptyState({ icon = "check", title, children }) {
  return (
    <div className="card empty">
      <span className="empty-icon"><Icon name={icon} size={28} /></span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function PageHead({ title, children, back }) {
  return (
    <header className="page-head">
      {back && (
        <a className="back-link" href={back.href}>
          <Icon name="back" size={18} />
          {back.label}
        </a>
      )}
      <h1 tabIndex={-1}>{title}</h1>
      {children}
    </header>
  );
}

// Turns any thrown error into a short, human message.
export function useErrorText() {
  const { t } = useI18n();
  return (err) => {
    if (err?.name === "LoginError") return err.reason === "active-session" ? t("errActiveSession") : t("errCredentials");
    if (err?.name === "ApiError") return err.status ? t("errServer", { status: err.status }) : t("errNetwork");
    return t("errUnknown");
  };
}
