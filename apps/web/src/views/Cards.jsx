import { useState } from "react";
import { Icon } from "../components/Icon.jsx";
import { EmptyState, PageHead } from "../components/ui.jsx";
import { useI18n } from "../lib/i18n.jsx";
import { updateDeck, useDeck } from "../lib/study-store.js";
import { useNow } from "../lib/time.js";
import { useToast } from "../lib/toast.jsx";

function groupByLesson(cards, otherLabel) {
  const groups = new Map();
  for (const card of cards) {
    const key = card.lessonNodeId ?? "other";
    if (!groups.has(key)) groups.set(key, { title: card.lesson ?? otherLabel, unit: card.unit, cards: [] });
    groups.get(key).cards.push(card);
  }
  for (const group of groups.values()) group.cards.sort((a, b) => a.front.localeCompare(b.front));
  return [...groups.values()].sort((a, b) => (a.title === otherLabel) - (b.title === otherLabel) || a.title.localeCompare(b.title));
}

export function Cards() {
  const { t, formatDue } = useI18n();
  const toast = useToast();
  const { deck } = useDeck();
  const [query, setQuery] = useState("");
  const now = useNow();

  const back = { href: "#/study", label: t("backToStudy") };
  if (!deck?.cards.length) {
    return (
      <>
        <PageHead title={t("browseCards")} back={back} />
        <EmptyState title={t("noCardsYet")} icon="cards">
          <a className="button primary" href="#/study/add">{t("addWords")}</a>
        </EmptyState>
      </>
    );
  }

  const q = query.trim().toLowerCase();
  const matches = q
    ? deck.cards.filter((c) => [c.front, c.back, c.lesson, c.example].some((f) => f?.toLowerCase().includes(q)))
    : deck.cards;
  const groups = groupByLesson(matches, t("otherVocabulary"));

  function remove(card) {
    const position = deck.cards.findIndex((c) => c.id === card.id);
    updateDeck((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== card.id) }));
    toast(t("cardDeleted", { word: card.front }), {
      action: {
        label: t("undo"),
        onClick: () => updateDeck((d) => {
          const cards = [...d.cards];
          cards.splice(Math.min(position, cards.length), 0, card);
          return { ...d, cards };
        }),
      },
    });
  }

  return (
    <>
      <PageHead title={t("browseCards")} back={back}>
        <p className="muted">{t("cardCount", { n: deck.cards.length })}</p>
      </PageHead>

      <div className="field search">
        <label htmlFor="card-search" className="visually-hidden">{t("searchCards")}</label>
        <Icon name="search" size={18} className="search-icon" />
        <input id="card-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchCards")} />
      </div>

      {groups.length === 0 && <p className="muted">{t("noMatches", { query })}</p>}

      {groups.map((group) => (
        <section key={group.title} className="card-group">
          <h2 className="section-title">
            {group.title}
            {group.unit && <span className="muted"> · {group.unit}</span>}
          </h2>
          <ul className="card-list">
            {group.cards.map((card) => (
              <li key={card.id} className="card word-row">
                <div className="word-main" lang="en">
                  <div className="word-title">
                    <strong>{card.front}</strong>
                    {card.partOfSpeech && <span className="badge">{card.partOfSpeech}</span>}
                    {card.phonetic && <span className="muted">{card.phonetic}</span>}
                  </div>
                  <p>{card.back}</p>
                  {card.example && <p className="example">“{card.example}”</p>}
                </div>
                <div className="word-side">
                  <span className={`due ${card.due <= now ? "is-due" : ""}`}>{formatDue(card.due, now)}</span>
                  <button type="button" className="icon-button" onClick={() => remove(card)} aria-label={t("deleteCard", { word: card.front })}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
