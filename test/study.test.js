import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { lookup, parseEntries } from "../src/study/dictionary.js";
import { cardTags, toAnkiTsv, toStudyNotes } from "../src/study/export.js";
import { dueCards, INTERVAL_DAYS, MAX_BOX, newCard, nextDue, schedule } from "../src/study/srs.js";
import { loadCourse, loadDeck, saveCourse, saveDeck } from "../src/study/store.js";

const DAY = 24 * 60 * 60 * 1000;

describe("srs", () => {
  test("new cards are due immediately in box 0", () => {
    const card = newCard({ front: "a", back: "b" }, { now: 100 });
    assert.equal(card.box, 0);
    assert.equal(card.due, 100);
    assert.ok(card.id);
  });

  test("good moves up one box, easy two, again resets", () => {
    const card = newCard({ front: "a", back: "b" }, { now: 0 });
    const good = schedule(card, "good", { now: 0 });
    assert.equal(good.box, 1);
    assert.equal(good.due, INTERVAL_DAYS[1] * DAY);

    const easy = schedule(good, "easy", { now: 0 });
    assert.equal(easy.box, 3);

    const again = schedule(easy, "again", { now: 5 });
    assert.equal(again.box, 1);
    assert.equal(again.due, 5);
    assert.equal(again.lapses, 1);
    assert.equal(again.reviews, 3);
  });

  test("box is capped and unknown ratings throw", () => {
    let card = newCard({ front: "a", back: "b" }, { now: 0 });
    for (let i = 0; i < 10; i++) card = schedule(card, "easy", { now: 0 });
    assert.equal(card.box, MAX_BOX);
    assert.throws(() => schedule(card, "meh"), TypeError);
  });

  test("dueCards orders oldest first; nextDue finds the soonest future card", () => {
    const cards = [
      { id: "1", due: 50, box: 2 },
      { id: "2", due: 10, box: 1 },
      { id: "3", due: 500, box: 1 },
      { id: "4", due: 300, box: 1 },
    ];
    assert.deepEqual(dueCards(cards, { now: 100 }).map((c) => c.id), ["2", "1"]);
    assert.equal(nextDue(cards, { now: 100 }), 300);
    assert.equal(nextDue([], { now: 100 }), null);
  });
});

describe("dictionary", () => {
  // Shape of https://api.dictionaryapi.dev/api/v2/entries/en/<word>
  const sample = [
    {
      word: "sustainable",
      phonetics: [{ text: "/səˈsteɪnəbəl/", audio: "" }],
      meanings: [
        {
          partOfSpeech: "adjective",
          definitions: [
            { definition: "Able to be sustained.", example: "a sustainable pace" },
            { definition: "Of or relating to a lifestyle that does not deplete resources." },
          ],
        },
      ],
    },
  ];

  test("parseEntries flattens senses and finds phonetics", () => {
    const { phonetic, senses } = parseEntries(sample);
    assert.equal(phonetic, "/səˈsteɪnəbəl/");
    assert.equal(senses.length, 2);
    assert.deepEqual(senses[0], { partOfSpeech: "adjective", definition: "Able to be sustained.", example: "a sustainable pace" });
    assert.equal(senses[1].example, null);
  });

  test("parseEntries tolerates junk", () => {
    assert.deepEqual(parseEntries({ title: "No Definitions Found" }), { phonetic: null, senses: [] });
    assert.deepEqual(parseEntries([{ meanings: [{ definitions: [{}] }] }]).senses, []);
  });

  test("lookup maps HTTP outcomes to statuses", async () => {
    const res = (status, body) => async () => ({ status, ok: status < 400, json: async () => body });
    assert.equal((await lookup("x", { fetchImpl: res(200, sample) })).status, "ok");
    assert.equal((await lookup("x", { fetchImpl: res(404, {}) })).status, "not-found");
    assert.equal((await lookup("x", { fetchImpl: res(500, {}) })).status, "error");
    assert.equal((await lookup("x", { fetchImpl: async () => { throw new Error("down"); } })).status, "offline");
  });

  test("lookup encodes the word", async () => {
    let url;
    await lookup(" ice cream ", { fetchImpl: async (u) => { url = u; return { status: 404 }; } });
    assert.ok(url.endsWith("/ice%20cream"));
  });
});

describe("export", () => {
  const cards = [
    {
      id: "1", front: "sustainable", back: "Able to <be> sustained\tok", partOfSpeech: "adjective",
      example: "a sustainable pace", phonetic: "/s/", unit: "Unit 2: Science & Nature", lesson: "Recycling", lessonNodeId: 2001,
    },
    { id: "2", front: "pipe|word", back: "has | pipes", unit: null, lesson: null, lessonNodeId: null },
  ];

  test("Anki export escapes HTML, strips tabs and tags by lesson", () => {
    const lines = toAnkiTsv(cards).trimEnd().split("\n");
    assert.deepEqual(lines.slice(0, 3), ["#separator:tab", "#html:true", "#tags column:3"]);
    const fields = lines[3].split("\t");
    assert.equal(fields.length, 3);
    assert.ok(fields[1].includes("&lt;be&gt;"));
    assert.ok(fields[1].startsWith("<i>adjective</i>"));
    assert.equal(fields[2], "ED22::Unit_2_Science_Nature::Recycling");
    assert.equal(cardTags(cards[1]), "ED22");
  });

  test("study notes list lessons with progress and escape table pipes", () => {
    const course = {
      syncedAt: 0,
      percent: 42,
      grade: "C",
      units: [{
        nodeId: 1, name: "Unit 2", lessons: [
          { nodeId: 2001, name: "Recycling", percent: 100, pending: false, todo: [] },
          { nodeId: 2002, name: "Movie Making", percent: 17, pending: true, todo: ["Practice", "Test"] },
        ],
      }],
    };
    const md = toStudyNotes(course, cards, { now: 0 });
    assert.ok(md.includes("## Unit 2"));
    assert.ok(md.includes("1 of 2 lessons still to do."));
    assert.ok(md.includes("### Recycling ✓"));
    assert.ok(md.includes("### Movie Making (17% · to do: Practice, Test)"));
    assert.ok(md.includes("| **sustainable** | adjective |"));
    assert.ok(md.includes("## Other vocabulary"));
    assert.ok(md.includes("pipe\\|word"));
  });

  test("study notes work with no synced course", () => {
    assert.ok(toStudyNotes(null, [], { now: 0 }).includes("Sync your lesson list"));
    assert.ok(toStudyNotes(null, cards, { now: 0 }).includes("## Vocabulary"));
  });
});

describe("store", () => {
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
    await assert.rejects(loadDeck(), /corrupt and was left untouched/);
    assert.equal(await readFile(file, "utf8"), "{broken");
  });

  test("course cache keeps names, progress and pending steps only", async () => {
    const overview = { percent: 50, grade: "B" };
    const lessons = [{
      nodeId: 7, code: "x", name: "L", percent: 50, pending: true,
      steps: [{ name: "Explore", percent: 100 }, { name: "Test", percent: 0 }],
    }];
    await saveCourse(overview, [{ unit: { nodeId: 1, name: "U", percent: 50 }, lessons }], { now: 9 });
    const course = await loadCourse();
    assert.equal(course.syncedAt, 9);
    assert.deepEqual(course.units[0].lessons[0], { nodeId: 7, name: "L", percent: 50, pending: true, todo: ["Test"] });
  });
});
