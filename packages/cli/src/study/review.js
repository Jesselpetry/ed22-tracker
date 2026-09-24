import readline from "node:readline";
import chalk from "chalk";
import { dueCards, nextDue, schedule } from "@ed22/core";

const RATINGS = { 1: "again", 2: "good", 3: "easy" };
const DAY_MS = 24 * 60 * 60 * 1000;

// Single-keypress input so reviewing is flip-and-rate without Enter.
function waitForKey(keys) {
  const { stdin } = process;
  readline.emitKeypressEvents(stdin);
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve) => {
    const onKey = (str, key = {}) => {
      let name = str;
      if (key.ctrl && key.name === "c") name = "q";
      else if (key.name === "space" || key.name === "return") name = "flip";
      if (!keys.includes(name)) return;
      stdin.off("keypress", onKey);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      resolve(name);
    };
    stdin.on("keypress", onKey);
  });
}

export function formatDue(due, now) {
  const days = Math.round((due - now) / DAY_MS);
  if (due <= now) return "now";
  if (days < 1) return "later today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function hint(text) {
  return chalk.gray(text.replace(/\[(\w+)\]/g, (_, k) => chalk.reset.bold(k)));
}

export async function runReview(deck, { save, now = () => Date.now() }) {
  const queue = dueCards(deck.cards, { now: now() });
  if (queue.length === 0) {
    const next = nextDue(deck.cards, { now: now() });
    console.log(chalk.green(`Nothing due. ${next ? `Next card ${formatDue(next, now())}.` : ""}`));
    return;
  }

  const counts = { again: 0, good: 0, easy: 0 };
  const seen = new Set();
  let quit = false;

  while (queue.length && !quit) {
    const card = queue.shift();
    const crumb = [card.unit, card.lesson].filter(Boolean).join(" › ");

    console.log(`\n${chalk.gray(`${queue.length + 1} left${crumb ? ` · ${crumb}` : ""}`)}`);
    console.log(`  ${chalk.bold.cyan(card.front)}${card.phonetic ? `  ${chalk.gray(card.phonetic)}` : ""}`);
    console.log(`  ${hint("[space] show answer   [q] stop")}`);
    if (await waitForKey(["flip", "q"]) === "q") break;

    const pos = card.partOfSpeech ? `${chalk.italic.gray(card.partOfSpeech)} ` : "";
    console.log(`  ${pos}${card.back}`);
    if (card.example) console.log(`  ${chalk.italic(`“${card.example}”`)}`);
    console.log(`  ${hint("[1] again   [2] good   [3] easy   [q] stop")}`);

    const key = await waitForKey(["1", "2", "3", "q"]);
    if (key === "q") {
      quit = true;
      continue;
    }

    const rating = RATINGS[key];
    const updated = schedule(card, rating, { now: now() });
    deck.cards = deck.cards.map((c) => (c.id === updated.id ? updated : c));
    await save(deck);

    counts[rating] += 1;
    seen.add(card.id);
    // Forgotten cards come back later in the same session.
    if (rating === "again") queue.push(updated);
  }

  const reviewed = counts.again + counts.good + counts.easy;
  if (reviewed === 0) return;
  const next = nextDue(deck.cards, { now: now() });
  console.log(
    `\n${chalk.bold(`Reviewed ${seen.size} card${seen.size === 1 ? "" : "s"}`)}  `
    + `${chalk.green(`${counts.good + counts.easy} remembered`)} · ${chalk.yellow(`${counts.again} again`)}`
    + (next ? chalk.gray(`  ·  next due ${formatDue(next, now())}`) : ""),
  );
}
