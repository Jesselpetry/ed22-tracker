import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildCourseOutline, isCourseOutline } from "../src/course.js";
import { emptyDeck, mergeDecks, parseDeck } from "../src/deck.js";
import { usesDefaultPassword } from "../src/ed22.js";
import { newCard } from "../src/srs.js";

const card = (fields) => ({ ...newCard({ front: "w", back: "m" }, { now: 0 }), ...fields });

describe("deck", () => {
  test("parseDeck accepts a CLI deck.json and rejects junk", () => {
    const deck = { version: 1, cards: [card({ id: "a" })] };
    assert.deepEqual(parseDeck(JSON.stringify(deck)), deck);
    assert.throws(() => parseDeck("{nope"), /invalid JSON/);
    assert.throws(() => parseDeck("{}"), /no cards list/);
    assert.throws(() => parseDeck(JSON.stringify({ cards: [{ id: "x" }] })), /card 1 is incomplete/);
  });

  test("mergeDecks adds new cards and keeps the most recently reviewed copy", () => {
    const base = { version: 1, cards: [card({ id: "a", box: 1, lastReviewedAt: 10 }), card({ id: "b", box: 2, lastReviewedAt: 50 })] };
    const incoming = { version: 1, cards: [card({ id: "a", box: 3, lastReviewedAt: 20 }), card({ id: "b", box: 0, lastReviewedAt: 5 }), card({ id: "c" })] };

    const { deck, added, updated } = mergeDecks(base, incoming);
    const byId = Object.fromEntries(deck.cards.map((c) => [c.id, c]));
    assert.equal(added, 1);
    assert.equal(updated, 1);
    assert.equal(byId.a.box, 3);
    assert.equal(byId.b.box, 2);
    assert.ok(byId.c);
  });

  test("merging into an empty deck copies everything", () => {
    const { deck, added } = mergeDecks(emptyDeck(), { cards: [card({ id: "x" })] });
    assert.equal(added, 1);
    assert.equal(deck.cards.length, 1);
  });
});

describe("course outline", () => {
  test("keeps names, progress and unfinished steps only", () => {
    const lessons = [{
      nodeId: 7, code: "x", name: "L", percent: 50, pending: true,
      steps: [{ name: "Explore", percent: 100 }, { name: "Test", percent: 0 }],
    }];
    const outline = buildCourseOutline({ percent: 50, grade: "B" }, [{ unit: { nodeId: 1, name: "U", percent: 50 }, lessons }], { now: 9 });
    assert.equal(outline.syncedAt, 9);
    assert.deepEqual(outline.units[0].lessons[0], { nodeId: 7, name: "L", percent: 50, pending: true, todo: ["Test"] });
    assert.equal(isCourseOutline(outline), true);
    assert.equal(isCourseOutline({}), false);
  });
});

test("usesDefaultPassword matches the last 5 digits of the student ID", () => {
  assert.equal(usesDefaultPassword("67070123", "70123"), true);
  assert.equal(usesDefaultPassword("67070123", "S3cure!pw"), false);
});
