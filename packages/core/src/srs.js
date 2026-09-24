// Leitner boxes. A card in box N comes back after INTERVAL_DAYS[N] days.
// Box 0 is "new, never reviewed".
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
export const MAX_BOX = INTERVAL_DAYS.length - 1;
const DAY_MS = 24 * 60 * 60 * 1000;

export function newCard(fields, { now = Date.now() } = {}) {
  return {
    id: globalThis.crypto.randomUUID(),
    ...fields,
    box: 0,
    due: now,
    reviews: 0,
    lapses: 0,
    createdAt: now,
  };
}

// rating: "again" (forgot), "good" (remembered), "easy" (instant).
export function schedule(card, rating, { now = Date.now() } = {}) {
  let box;
  if (rating === "again") box = 1;
  else if (rating === "good") box = Math.min(card.box + 1, MAX_BOX);
  else if (rating === "easy") box = Math.min(card.box + 2, MAX_BOX);
  else throw new TypeError(`Unknown rating: ${rating}`);

  return {
    ...card,
    box,
    due: rating === "again" ? now : now + INTERVAL_DAYS[box] * DAY_MS,
    reviews: card.reviews + 1,
    lapses: card.lapses + (rating === "again" && card.box > 1 ? 1 : 0),
    lastReviewedAt: now,
  };
}

export function dueCards(cards, { now = Date.now() } = {}) {
  return cards
    .filter((c) => c.due <= now)
    .sort((a, b) => a.due - b.due || a.box - b.box);
}

export function nextDue(cards, { now = Date.now() } = {}) {
  const upcoming = cards.filter((c) => c.due > now).map((c) => c.due);
  return upcoming.length ? Math.min(...upcoming) : null;
}
