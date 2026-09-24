import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon.jsx";
import { useI18n } from "./i18n.jsx";

const ToastContext = createContext(() => {});
const MAX_VISIBLE = 3;

export function ToastProvider({ children }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((item) => item.id !== id));
  }, []);

  // toast("Saved") or toast("Deleted", { action: { label: "Undo", onClick } })
  const toast = useCallback((message, { tone = "info", action, duration = action ? 7000 : 4000 } = {}) => {
    const id = crypto.randomUUID();
    setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), { id, message, tone, action }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast tone-${item.tone}`}>
            <span className="toast-message">{item.message}</span>
            {item.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  item.action.onClick();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            )}
            <button type="button" className="icon-button small" aria-label={t("close")} onClick={() => dismiss(item.id)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
