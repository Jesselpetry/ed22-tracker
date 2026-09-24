import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { normalizeLessons, normalizeOverview, stepColumns, toPercent } from "../src/normalize.js";

const fixture = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

test("toPercent never shows 0% once started or 100% before done", () => {
  assert.equal(toPercent(0), 0);
  assert.equal(toPercent(0.004), 1);
  assert.equal(toPercent(0.996), 99);
  assert.equal(toPercent(1), 100);
  assert.equal(toPercent(0.4213), 42);
  assert.equal(toPercent(null), null);
});

test("overview maps units and keeps missing progress unknown", async () => {
  const overview = normalizeOverview(await fixture("overview.json"));
  assert.equal(overview.percent, 42);
  assert.equal(overview.grade, "C");
  assert.deepEqual(overview.units.map((u) => u.percent), [100, 50, 1, 99, null]);
  assert.equal(overview.units[0].grade, "A");
  assert.equal(overview.units[0].parentNodeId, 9000);
});

test("lessons derive step progress from tasks when missing", async () => {
  const lessons = normalizeLessons(await fixture("unit-tree.json"));
  const [done, partial, unknown] = lessons;

  assert.equal(done.percent, 100);
  assert.equal(done.pending, false);
  assert.equal(done.code, "recycling");

  assert.deepEqual(
    partial.steps.map((s) => [s.name, s.done, s.total, s.percent]),
    [["Explore", 1, 2, 50], ["Practice", 0, 2, 0], ["Test", 0, 1, 0]],
  );
  assert.equal(partial.steps[2].isTest, true);
  assert.equal(partial.percent, 17);
  assert.equal(partial.pending, true);

  assert.equal(unknown.percent, null);
  assert.equal(unknown.pending, true);
  assert.equal(unknown.steps[0].done, null);
});

test("stepColumns keeps first-seen order without duplicates", async () => {
  const lessons = normalizeLessons(await fixture("unit-tree.json"));
  assert.deepEqual(stepColumns(lessons), ["Explore", "Practice", "Test"]);
});
