import { buildCourseOutline, emptyDeck, isCourseOutline, parseDeck } from "@ed22/core";
import { configFile, readConfigText, writeConfigFile } from "../storage.js";

const DECK_FILE = "deck.json";
const COURSE_FILE = "course.json";

// Unlike the session, the deck is user work: a corrupt file is an error, never
// silently replaced with an empty deck.
export async function loadDeck() {
  const text = await readConfigText(DECK_FILE);
  if (text === null) return emptyDeck();
  try {
    return parseDeck(text);
  } catch (err) {
    throw new Error(`${err.message} The flashcard file was left untouched: ${configFile(DECK_FILE)}`, { cause: err });
  }
}

export async function saveDeck(deck) {
  await writeConfigFile(DECK_FILE, JSON.stringify(deck, null, 2), { mode: 0o644 });
}

export async function loadCourse() {
  try {
    const course = JSON.parse(await readConfigText(COURSE_FILE));
    return isCourseOutline(course) ? course : null;
  } catch {
    return null;
  }
}

export async function saveCourse(overview, unitResults, { now = Date.now() } = {}) {
  const course = buildCourseOutline(overview, unitResults, { now });
  await writeConfigFile(COURSE_FILE, JSON.stringify(course, null, 2), { mode: 0o644 });
  return course;
}
