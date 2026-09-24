import { configFile, readConfigText, writeConfigFile } from "../storage.js";

const DECK_FILE = "deck.json";
const COURSE_FILE = "course.json";

// Unlike the session, the deck is user work: a corrupt file is an error, never
// silently replaced with an empty deck.
export async function loadDeck() {
  const text = await readConfigText(DECK_FILE);
  if (text === null) return { version: 1, cards: [] };

  let deck;
  try {
    deck = JSON.parse(text);
  } catch {
    throw new Error(`Flashcard file is corrupt and was left untouched: ${configFile(DECK_FILE)}`);
  }
  if (!Array.isArray(deck?.cards)) {
    throw new Error(`Flashcard file has an unexpected format: ${configFile(DECK_FILE)}`);
  }
  return deck;
}

export async function saveDeck(deck) {
  await writeConfigFile(DECK_FILE, JSON.stringify(deck, null, 2), { mode: 0o644 });
}

// Offline copy of the course outline (names and progress only), so study mode
// works without signing in.
export async function loadCourse() {
  try {
    return JSON.parse(await readConfigText(COURSE_FILE));
  } catch {
    return null;
  }
}

export async function saveCourse(overview, unitResults, { now = Date.now() } = {}) {
  const course = {
    syncedAt: now,
    percent: overview.percent,
    grade: overview.grade,
    units: unitResults.map(({ unit, lessons }) => ({
      nodeId: unit.nodeId,
      name: unit.name,
      percent: unit.percent,
      lessons: lessons.map((l) => ({
        nodeId: l.nodeId,
        name: l.name,
        percent: l.percent,
        pending: l.pending,
        todo: l.steps.filter((s) => s.percent !== 100).map((s) => s.name),
      })),
    })),
  };
  await writeConfigFile(COURSE_FILE, JSON.stringify(course, null, 2), { mode: 0o644 });
  return course;
}
