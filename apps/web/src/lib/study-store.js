import { useSyncExternalStore } from "react";
import { buildCourseOutline, emptyDeck, isCourseOutline, parseDeck } from "@ed22/core";
import { readText, remove, writeJson } from "./storage.js";

const DECK_KEY = "ed22.deck";
const COURSE_KEY = "ed22.course";

// A small store over localStorage: stable snapshots for useSyncExternalStore,
// updates shared between components and between open tabs.
function createStore(key, read) {
  let snapshot;
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l());

  const onStorage = (event) => {
    if (event.key === key || event.key === null) {
      snapshot = undefined;
      emit();
    }
  };

  return {
    subscribe(listener) {
      if (listeners.size === 0) window.addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot() {
      if (snapshot === undefined) snapshot = read();
      return snapshot;
    },
    set(next) {
      snapshot = next;
      emit();
    },
  };
}

// { deck, error, raw }: a corrupt deck is reported, never replaced silently.
function readDeck() {
  const raw = readText(DECK_KEY);
  if (raw === null) return { deck: emptyDeck(), error: null, raw: null };
  try {
    return { deck: parseDeck(raw), error: null, raw: null };
  } catch (err) {
    return { deck: null, error: err.message, raw };
  }
}

function readCourse() {
  try {
    const course = JSON.parse(readText(COURSE_KEY));
    return isCourseOutline(course) ? course : null;
  } catch {
    return null;
  }
}

const deckStore = createStore(DECK_KEY, readDeck);
const courseStore = createStore(COURSE_KEY, readCourse);

export function useDeck() {
  return useSyncExternalStore(deckStore.subscribe, deckStore.getSnapshot);
}

export function useCourse() {
  return useSyncExternalStore(courseStore.subscribe, courseStore.getSnapshot);
}

// Returns false when the browser refused to save (the change still shows
// for this visit).
export function updateDeck(change) {
  const { deck } = deckStore.getSnapshot();
  if (!deck) throw new Error("Flashcards are unreadable; reset or restore them first.");
  const next = change(deck);
  const saved = writeJson(DECK_KEY, next);
  deckStore.set({ deck: next, error: null, raw: null });
  return saved;
}

export function resetDeck() {
  remove(DECK_KEY);
  deckStore.set({ deck: emptyDeck(), error: null, raw: null });
}

export function saveCourse(overview, unitResults) {
  const course = buildCourseOutline(overview, unitResults);
  writeJson(COURSE_KEY, course);
  courseStore.set(course);
  return course;
}
