import { useCallback, useEffect, useRef, useState } from "react";
import { dueCards, nextDue, schedule } from "@ed22/core";
import { EmptyState, PageHead } from "../components/ui.jsx";
import { useI18n } from "../lib/i18n.jsx";
import { updateDeck, useDeck } from "../lib/study-store.js";
import { useNow } from "../lib/time.js";
import { useToast } from "../lib/toast.jsx";

const RATINGS = [
  { key: "1", rating: "again", label: "rateAgain" },
  { key: "2", rating: "good", label: "rateGood" },
  { key: "3", rating: "easy", label: "rateEasy" },
];

function isTyping(event) {
  const el = event.target;
  return el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export function Review() {
  const { t, formatDue } = useI18n();
  const toast = useToast();
  const { deck } = useDeck();

  // Queue of card ids fixed at the start of the session; "again" re-queues.
  const [queue, setQueue] = useState(() => (deck ? dueCards(deck.cards).map((c) => c.id) : []));
  const [flipped, setFlipped] = useState(false);
  const [counts, setCounts] = useState({ again: 0, good: 0, easy: 0 });
  const [uniqueReviewed, setUniqueReviewed] = useState(0);
  const seen = useRef(new Set());
  const now = useNow();
  const warnedStorage = useRef(false);
  const cardRef = useRef(null);

  const card = deck?.cards.find((c) => c.id === queue[0]);

  const rate = useCallback((rating) => {
    if (!card) return;
    const updated = schedule(card, rating);
    const saved = updateDeck((d) => ({ ...d, cards: d.cards.map((c) => (c.id === updated.id ? updated : c)) }));
    if (!saved && !warnedStorage.current) {
      warnedStorage.current = true;
      toast(t("storageBlocked"), { tone: "error" });
    }
    if (!seen.current.has(card.id)) {
      seen.current.add(card.id);
      setUniqueReviewed((n) => n + 1);
    }
    setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));
    setQueue((q) => (rating === "again" ? [...q.slice(1), q[0]] : q.slice(1)));
    setFlipped(false);
  }, [card, t, toast]);

  useEffect(() => {
    const onKey = (event) => {
      if (isTyping(event) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (!flipped && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        setFlipped(true);
      } else if (flipped) {
        const match = RATINGS.find((r) => r.key === event.key);
        if (match) {
          event.preventDefault();
          rate(match.rating);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, rate]);

  // Keep keyboard focus on the card so screen readers announce the new side.
  useEffect(() => {
    cardRef.current?.focus();
  }, [flipped, card?.id]);

  const back = { href: "#/study", label: t("backToStudy") };
  const reviewed = counts.again + counts.good + counts.easy;

  if (!card) {
    const next = deck ? nextDue(deck.cards, { now }) : null;
    return (
      <>
        <PageHead title={t("reviewTitle")} back={back} />
        {reviewed > 0 ? (
          <EmptyState title={t("sessionDone")}>
            <p>{t("sessionSummary", { n: uniqueReviewed, remembered: counts.good + counts.easy, again: counts.again })}</p>
            {next && <p className="muted">{t("nextDue", { when: formatDue(next, now) })}</p>}
            <div className="button-row center">
              <a className="button primary" href="#/study">{t("backToStudy")}</a>
              <a className="button secondary" href="#/study/add">{t("addWords")}</a>
            </div>
          </EmptyState>
        ) : (
          <EmptyState title={t("nothingToReview")} icon="cards">
            <div className="button-row center">
              <a className="button primary" href="#/study/add">{t("addWords")}</a>
            </div>
          </EmptyState>
        )}
      </>
    );
  }

  const crumb = [card.unit, card.lesson].filter(Boolean).join(" › ");

  return (
    <>
      <PageHead title={t("reviewTitle")} back={back}>
        <p className="muted">{t("cardsLeft", { n: queue.length })}</p>
      </PageHead>

      <section className={`card flashcard ${flipped ? "is-flipped" : ""}`} ref={cardRef} tabIndex={-1} aria-live="polite">
        {crumb && <p className="eyebrow">{crumb}</p>}
        <p className="flashcard-front" lang="en">{card.front}</p>
        {card.phonetic && <p className="muted">{card.phonetic}</p>}

        {flipped && (
          <div className="flashcard-back" lang="en">
            {card.partOfSpeech && <span className="badge">{card.partOfSpeech}</span>}
            <p>{card.back}</p>
            {card.example && <p className="example">“{card.example}”</p>}
          </div>
        )}
      </section>

      {!flipped ? (
        <button type="button" className="button primary large block" onClick={() => setFlipped(true)}>
          {t("showAnswer")} <kbd>{t("keySpace")}</kbd>
        </button>
      ) : (
        <div className="rating-row" role="group" aria-label={t("rateLabel")}>
          {RATINGS.map(({ key, rating, label }) => (
            <button key={rating} type="button" className={`button rate rate-${rating}`} onClick={() => rate(rating)}>
              <span>{t(label)}</span>
              <small>{formatDue(schedule(card, rating, { now }).due, now)}</small>
              <kbd>{key}</kbd>
            </button>
          ))}
        </div>
      )}
      <p className="hint center">{t("reviewKeysHint")}</p>
    </>
  );
}
