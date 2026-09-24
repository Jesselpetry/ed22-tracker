// A deck is { version: 1, cards: Card[] }. The CLI keeps it in deck.json and
// the web app in localStorage; the same JSON moves between them as a backup.
export const DECK_VERSION = 1;

export function emptyDeck() {
  return { version: DECK_VERSION, cards: [] };
}

function isCard(card) {
  return typeof card?.id === "string"
    && typeof card.front === "string"
    && typeof card.back === "string"
    && Number.isFinite(card.box)
    && Number.isFinite(card.due);
}

// Throws on anything that is not a deck, so callers never replace real cards
// with a half-read file.
export function parseDeck(text) {
  let deck;
  try {
    deck = JSON.parse(text);
  } catch {
    throw new TypeError("Not a valid flashcard backup (invalid JSON).");
  }
  if (!Array.isArray(deck?.cards)) {
    throw new TypeError("Not a valid flashcard backup (no cards list).");
  }
  const bad = deck.cards.findIndex((c) => !isCard(c));
  if (bad !== -1) {
    throw new TypeError(`Not a valid flashcard backup (card ${bad + 1} is incomplete).`);
  }
  return { version: DECK_VERSION, cards: deck.cards };
}

function lastTouched(card) {
  return card.lastReviewedAt ?? card.createdAt ?? 0;
}

// Union by card id. When both sides have a card, the more recently reviewed
// copy wins so review progress from either device is kept.
export function mergeDecks(base, incoming) {
  const byId = new Map(base.cards.map((c) => [c.id, c]));
  let added = 0;
  let updated = 0;
  for (const card of incoming.cards) {
    const existing = byId.get(card.id);
    if (!existing) {
      byId.set(card.id, card);
      added += 1;
    } else if (lastTouched(card) > lastTouched(existing)) {
      byId.set(card.id, card);
      updated += 1;
    }
  }
  return { deck: { version: DECK_VERSION, cards: [...byId.values()] }, added, updated };
}
