import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { STRINGS, translate } from "../src/lib/strings.js";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

// Keys built at runtime (template strings / lookup tables) that a regex scan cannot see.
const DYNAMIC_KEYS = [
  "theme_auto", "theme_light", "theme_dark",
  "statusDone", "statusNotStarted", "statusInProgress", "statusUnknown",
  "rateAgain", "rateGood", "rateEasy",
];

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.jsx?$/.test(e.name) ? [full] : [];
  }));
  return files.flat();
}

function placeholders(value) {
  const text = typeof value === "object" ? Object.values(value).join(" ") : value;
  return [...new Set(text.match(/\{\w+\}/g) ?? [])].filter((p) => p !== "{n}").sort();
}

test("English and Thai define the same keys and placeholders", () => {
  const en = Object.keys(STRINGS.en).sort();
  const th = Object.keys(STRINGS.th).sort();
  assert.deepEqual(th, en, "key sets differ");
  for (const key of en) {
    assert.deepEqual(placeholders(STRINGS.th[key]), placeholders(STRINGS.en[key]), `placeholders differ for ${key}`);
  }
});

test("every key used in the app exists", async () => {
  const used = new Set(DYNAMIC_KEYS);
  for (const file of await sourceFiles(SRC)) {
    const text = await readFile(file, "utf8");
    for (const [, key] of text.matchAll(/\bt\(\s*"(\w+)"/g)) used.add(key);
  }
  const missing = [...used].filter((key) => !(key in STRINGS.en));
  assert.deepEqual(missing, []);
});

test("translate fills variables and picks plural forms", () => {
  assert.equal(translate("en", "cardCount", { n: 1 }), "1 card");
  assert.equal(translate("en", "cardCount", { n: 3 }), "3 cards");
  assert.equal(translate("th", "cardCount", { n: 3 }), "3 การ์ด");
  assert.equal(translate("en", "wordAdded", { word: "eco" }), "Added “eco”.");
  assert.equal(translate("xx", "undo"), "Undo");
  assert.equal(translate("en", "no_such_key"), "no_such_key");
});
