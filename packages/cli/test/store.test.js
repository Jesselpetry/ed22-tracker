import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { newCard } from "@ed22/core";
import { loadCourse, loadDeck, saveCourse, saveDeck } from "../src/study/store.js";

let dir;
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "ed22-study-"));
  process.env.ED22_CONFIG_DIR = dir;
});
after(async () => {
  delete process.env.ED22_CONFIG_DIR;
  await rm(dir, { recursive: true, force: true });
});

test("deck round-trips and starts empty", async () => {
  assert.deepEqual(await loadDeck(), { version: 1, cards: [] });
  await saveDeck({ version: 1, cards: [newCard({ front: "a", back: "b" })] });
  assert.equal((await loadDeck()).cards[0].front, "a");
});

test("a corrupt deck throws and is not overwritten", async () => {
  const file = path.join(dir, "deck.json");
  await writeFile(file, "{broken");
  await assert.rejects(loadDeck(), /left untouched/);
  assert.equal(await readFile(file, "utf8"), "{broken");
});

test("course cache round-trips; junk loads as null", async () => {
  const overview = { percent: 50, grade: "B" };
  const lessons = [{ nodeId: 7, name: "L", percent: 50, pending: true, steps: [{ name: "Test", percent: 0 }] }];
  await saveCourse(overview, [{ unit: { nodeId: 1, name: "U", percent: 50 }, lessons }], { now: 9 });
  assert.equal((await loadCourse()).syncedAt, 9);

  await writeFile(path.join(dir, "course.json"), "[]");
  assert.equal(await loadCourse(), null);
});
