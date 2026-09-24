import { useEffect, useRef } from "react";
import { Layout } from "./components/Layout.jsx";
import { EmptyState, Notice, PageHead, Skeleton } from "./components/ui.jsx";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { I18nProvider, useI18n } from "./lib/i18n.jsx";
import { match, navigate, useRoute } from "./lib/router.js";
import { useDeck } from "./lib/study-store.js";
import { ToastProvider } from "./lib/toast.jsx";
import { AddWords } from "./views/AddWords.jsx";
import { Cards } from "./views/Cards.jsx";
import { Dashboard } from "./views/Dashboard.jsx";
import { Login } from "./views/Login.jsx";
import { Pending } from "./views/Pending.jsx";
import { Review } from "./views/Review.jsx";
import { Study } from "./views/Study.jsx";
import { Unit } from "./views/Unit.jsx";

// Progress pages need ED22; study pages work offline without signing in.
function NeedsAuth({ children }) {
  const { t } = useI18n();
  const auth = useAuth();

  if (auth.status === "ready") return children;
  if (auth.status === "restoring") return <Skeleton lines={3} />;
  if (auth.status === "offline") {
    return (
      <>
        <PageHead title={t("offlineTitle")} />
        <Notice tone="error">
          {t("offlineBody")}{" "}
          <button type="button" className="link-button" onClick={auth.retry}>{t("tryAgain")}</button>
        </Notice>
        <a className="button secondary" href="#/study">{t("studyWithoutSignIn")}</a>
      </>
    );
  }
  return <Login />;
}

function LoginRoute() {
  const auth = useAuth();
  useEffect(() => {
    if (auth.status === "ready") navigate("/");
  }, [auth.status]);
  return auth.status === "ready" ? null : <Login />;
}

function NotFound() {
  const { t } = useI18n();
  return (
    <EmptyState title={t("notFoundTitle")} icon="info">
      <p className="muted">{t("notFoundBody")}</p>
      <a className="button primary" href="#/">{t("goHome")}</a>
    </EmptyState>
  );
}

function Page({ path }) {
  const { error: deckError } = useDeck();
  // Unreadable flashcards: every study page shows the recovery screen instead.
  if (deckError && path.startsWith("/study")) return <Study />;
  if (path === "/") return <NeedsAuth><Dashboard /></NeedsAuth>;
  if (path === "/login") return <LoginRoute />;
  if (path === "/pending") return <NeedsAuth><Pending /></NeedsAuth>;
  const unit = match(path, "/unit/:id");
  if (unit) return <NeedsAuth><Unit key={unit.id} id={unit.id} /></NeedsAuth>;
  if (path === "/study") return <Study />;
  if (path === "/study/review") return <Review />;
  if (path === "/study/add") return <AddWords />;
  if (path === "/study/cards") return <Cards />;
  return <NotFound />;
}

function Shell() {
  const path = useRoute();
  const firstRender = useRef(true);

  // On navigation: back to the top, and move focus to the new page heading so
  // screen readers announce it. Skipped on first load.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.querySelector("main h1")?.focus({ preventScroll: true });
  }, [path]);

  return (
    <Layout section={path.startsWith("/study") ? "study" : "progress"}>
      <Page path={path} />
    </Layout>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
