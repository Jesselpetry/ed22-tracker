import { useState } from "react";
import { dueCards, MAX_BOX, mergeDecks, nextDue, parseDeck, toAnkiTsv, toStudyNotes } from "@ed22/core";
import { Icon } from "../components/Icon.jsx";
import { Notice, PageHead, useErrorText } from "../components/ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import { dateStamp, download } from "../lib/download.js";
import { useI18n } from "../lib/i18n.jsx";
import { resetDeck, updateDeck, useCourse, useDeck } from "../lib/study-store.js";
import { useNow } from "../lib/time.js";
import { useToast } from "../lib/toast.jsx";

function DeckError({ error, raw }) {
  const { t } = useI18n();
  return (
    <>
      <PageHead title={t("studyTitle")} />
      <Notice tone="error">
        <strong>{t("deckCorruptTitle")}</strong> {t("deckCorruptBody")} <code>{error}</code>
      </Notice>
      <div className="button-row">
        <button type="button" className="button secondary"
          onClick={() => download(`ed22-flashcards-damaged-${dateStamp()}.json`, raw, "application/json")}>
          <Icon name="download" size={18} />
          {t("deckDownloadDamaged")}
        </button>
        <button type="button" className="button danger" onClick={() => window.confirm(t("deckResetConfirm")) && resetDeck()}>
          {t("deckReset")}
        </button>
      </div>
    </>
  );
}

function Stat({ value, label }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function Study() {
  const { t, formatDate, formatDue } = useI18n();
  const auth = useAuth();
  const toast = useToast();
  const errorText = useErrorText();
  const { deck, error, raw } = useDeck();
  const course = useCourse();
  const [sync, setSync] = useState(null);
  const now = useNow();

  if (error) return <DeckError error={error} raw={raw} />;

  const cards = deck.cards;
  const due = dueCards(cards, { now }).length;
  const next = nextDue(cards, { now });
  const mastered = cards.filter((c) => c.box >= MAX_BOX - 1).length;
  const lessonCount = course?.units.reduce((sum, u) => sum + u.lessons.length, 0) ?? 0;

  async function onSync() {
    setSync({ done: 0 });
    try {
      const results = await auth.loadAll((done) => setSync({ done }));
      const lessons = results.reduce((sum, r) => sum + r.lessons.length, 0);
      toast(t("syncDone", { units: results.length, lessons }));
    } catch (err) {
      toast(errorText(err), { tone: "error" });
    } finally {
      setSync(null);
    }
  }

  async function onImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const incoming = parseDeck(await file.text());
      let result;
      const saved = updateDeck((current) => {
        result = mergeDecks(current, incoming);
        return result.deck;
      });
      toast(t("importDone", { n: result.added, updated: result.updated }));
      if (!saved) toast(t("storageBlocked"), { tone: "error" });
    } catch (err) {
      toast(t("importFailed", { reason: err.message }), { tone: "error" });
    }
  }

  return (
    <>
      <PageHead title={t("studyTitle")}>
        <p className="muted">{t("studySubtitle")}</p>
      </PageHead>

      <section className="card review-panel">
        <div className="stats">
          <Stat value={cards.length} label={t("statCards")} />
          <Stat value={due} label={t("statDue")} />
          <Stat value={mastered} label={t("statMastered")} />
        </div>
        {due > 0 ? (
          <a className="button primary large block" href="#/study/review">
            {t("reviewNow", { n: due })}
          </a>
        ) : (
          <p className="muted center">
            {cards.length ? t("nothingDue", { when: next ? formatDue(next, now) : "–" }) : t("noCardsYet")}
          </p>
        )}
      </section>

      <div className="action-grid">
        <a className="card action" href="#/study/add">
          <span className="action-icon"><Icon name="plus" /></span>
          <span>
            <strong>{t("addWords")}</strong>
            <span className="muted">{t("addWordsHint")}</span>
          </span>
        </a>
        <a className="card action" href="#/study/cards">
          <span className="action-icon"><Icon name="cards" /></span>
          <span>
            <strong>{t("browseCards")}</strong>
            <span className="muted">{t("browseCardsHint", { n: cards.length })}</span>
          </span>
        </a>
      </div>

      <section className="card">
        <h2>{t("lessonListTitle")}</h2>
        <p className="muted">
          {course
            ? t("lessonListSynced", { date: formatDate(course.syncedAt), units: course.units.length, lessons: lessonCount })
            : t("lessonListMissing")}
        </p>
        {auth.status === "ready" ? (
          <button type="button" className="button secondary" onClick={onSync} disabled={Boolean(sync)}>
            <Icon name="refresh" size={18} className={sync ? "spin" : ""} />
            {sync ? t("syncing", { n: sync.done, total: auth.overview.units.length }) : course ? t("resync") : t("sync")}
          </button>
        ) : (
          <a className="button secondary" href="#/login">{t("signInToSync")}</a>
        )}
      </section>

      <section className="card">
        <h2>{t("exportTitle")}</h2>
        <p className="muted">{t("exportBody")}</p>
        <div className="button-row">
          <button type="button" className="button secondary"
            onClick={() => download(`ed22-study-notes-${dateStamp()}.md`, toStudyNotes(course, cards), "text/markdown")}>
            <Icon name="doc" size={18} />
            {t("exportNotes")}
          </button>
          <button type="button" className="button secondary" disabled={!cards.length}
            onClick={() => download(`ed22-flashcards-anki-${dateStamp()}.txt`, toAnkiTsv(cards))}>
            <Icon name="download" size={18} />
            {t("exportAnki")}
          </button>
          <button type="button" className="button secondary" disabled={!cards.length}
            onClick={() => download(`ed22-flashcards-${dateStamp()}.json`, JSON.stringify(deck, null, 2), "application/json")}>
            <Icon name="download" size={18} />
            {t("exportBackup")}
          </button>
          <label className="button secondary file-button">
            <Icon name="upload" size={18} />
            {t("importBackup")}
            <input type="file" accept=".json,application/json" className="visually-hidden" onChange={onImport} />
          </label>
        </div>
        <p className="hint">{t("backupHint")}</p>
      </section>
    </>
  );
}
