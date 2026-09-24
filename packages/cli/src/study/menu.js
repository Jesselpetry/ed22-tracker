import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { confirm, input, select, Separator } from "@inquirer/prompts";
import chalk from "chalk";
import Table from "cli-table3";
import { withSpinner } from "../ui/spinner.js";
import { dueCards, lookup, mergeDecks, newCard, parseDeck, toAnkiTsv, toStudyNotes } from "@ed22/core";
import { formatDue, runReview } from "./review.js";
import { loadCourse, loadDeck, saveDeck } from "./store.js";

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function pickLesson(course) {
  if (!course) {
    console.log(chalk.gray("Tip: sync your lesson list first to tag words by lesson."));
    return null;
  }

  const choices = [{ name: "No specific lesson", value: null }];
  let firstPending;
  for (const unit of course.units) {
    choices.push(new Separator(chalk.bold(unit.name)));
    for (const lesson of unit.lessons) {
      const value = { unit: unit.name, lesson: lesson.name, lessonNodeId: lesson.nodeId };
      firstPending ??= lesson.pending ? value : undefined;
      choices.push({ name: `  ${lesson.name}${lesson.pending ? chalk.gray("  to do") : ""}`, value });
    }
  }
  // Default to the first unfinished lesson: most likely what you are studying.
  return select({ message: "Which lesson are these words from?", choices, pageSize: 15, default: firstPending });
}

async function addWords(course) {
  const tag = await pickLesson(course);
  let added = 0;

  for (;;) {
    const word = (await input({ message: `Word or phrase ${chalk.gray("(empty to finish)")}` })).trim();
    if (!word) break;

    const deck = await loadDeck();
    const duplicate = deck.cards.some((c) => c.front.toLowerCase() === word.toLowerCase()
      && (c.lessonNodeId ?? null) === (tag?.lessonNodeId ?? null));
    if (duplicate) {
      console.log(chalk.yellow(`"${word}" is already saved${tag ? ` for ${tag.lesson}` : ""}.`));
      continue;
    }

    const result = await withSpinner(`Looking up "${word}"…`, () => lookup(word));
    let sense = null;
    if (result.status === "ok") {
      sense = await select({
        message: "Pick a meaning",
        choices: [
          ...result.senses.map((s) => ({
            name: `${s.partOfSpeech ? `${chalk.italic.gray(s.partOfSpeech)} ` : ""}${truncate(s.definition, 90)}`,
            value: s,
          })),
          { name: chalk.gray("Write my own"), value: null },
        ],
      });
    } else {
      console.log(chalk.gray(result.status === "not-found"
        ? "No dictionary entry. Add your own meaning."
        : "Dictionary unavailable (offline?). Add your own meaning."));
    }

    const back = sense?.definition ?? (await input({
      message: "Meaning (English or Thai)",
      validate: (v) => v.trim().length > 0 || "Add a meaning",
    })).trim();
    const example = (await input({
      message: `Example sentence ${chalk.gray("(optional)")}`,
      default: sense?.example ?? undefined,
    })).trim();

    deck.cards.push(newCard({
      front: word,
      back,
      partOfSpeech: sense?.partOfSpeech ?? null,
      example: example || null,
      phonetic: result.phonetic,
      unit: tag?.unit ?? null,
      lesson: tag?.lesson ?? null,
      lessonNodeId: tag?.lessonNodeId ?? null,
    }));
    await saveDeck(deck);
    added += 1;
    console.log(chalk.green(`✓ Added "${word}"`) + chalk.gray(tag ? ` · ${tag.lesson}` : ""));
  }

  if (added) console.log(chalk.gray(`${plural(added, "card")} added, ready to review now.`));
}

function renderCards(cards, now) {
  const table = new Table({
    head: ["Word", "Meaning", "Lesson", "Box", "Due"].map((h) => chalk.bold(h)),
    style: { head: [], border: ["gray"] },
  });
  const sorted = [...cards].sort((a, b) => (a.lesson ?? "~").localeCompare(b.lesson ?? "~") || a.front.localeCompare(b.front));
  for (const c of sorted) {
    table.push([
      chalk.bold(truncate(c.front, 24)),
      truncate(c.back, 48),
      chalk.gray(truncate(c.lesson ?? "–", 20)),
      c.box,
      c.due <= now ? chalk.yellow("now") : chalk.gray(formatDue(c.due, now)),
    ]);
  }
  return table.toString();
}

async function browse() {
  const deck = await loadDeck();
  console.log(`\n${renderCards(deck.cards, Date.now())}\n`);

  const action = await select({
    message: "Cards",
    choices: [{ name: "Back", value: "back" }, { name: "Delete a card…", value: "delete" }],
  });
  if (action !== "delete") return;

  const card = await select({
    message: "Delete which card?",
    pageSize: 12,
    choices: [
      { name: chalk.gray("Cancel"), value: null },
      ...deck.cards.map((c) => ({ name: `${c.front}${c.lesson ? chalk.gray(` · ${c.lesson}`) : ""}`, value: c })),
    ],
  });
  if (!card || !(await confirm({ message: `Delete "${card.front}"?`, default: false }))) return;

  deck.cards = deck.cards.filter((c) => c.id !== card.id);
  await saveDeck(deck);
  console.log(chalk.green(`Deleted "${card.front}".`));
}

async function exportFile(defaultName, content, afterHint) {
  const target = path.resolve((await input({ message: "Save as", default: defaultName })).trim() || defaultName);
  const exists = await access(target).then(() => true, () => false);
  if (exists && !(await confirm({ message: `${path.basename(target)} exists. Overwrite?`, default: false }))) return;

  await writeFile(target, content);
  console.log(chalk.green(`Saved ${target}`));
  if (afterHint) console.log(chalk.gray(afterHint));
}

// Same JSON as the web app's backup, so cards move freely between the two.
async function importBackup() {
  const file = path.resolve((await input({ message: "Backup file to import", default: "ed22-flashcards.json" })).trim());
  let incoming;
  try {
    incoming = parseDeck(await readFile(file, "utf8"));
  } catch (err) {
    console.log(chalk.red(err.code === "ENOENT" ? `File not found: ${file}` : err.message));
    return;
  }
  const { deck, added, updated } = mergeDecks(await loadDeck(), incoming);
  await saveDeck(deck);
  console.log(chalk.green(`Imported: ${plural(added, "new card")}, ${plural(updated, "card")} updated.`));
}

// `sync` signs in if needed and refreshes the offline lesson list.
export async function runStudyMenu({ sync }) {
  for (;;) {
    const deck = await loadDeck();
    const course = await loadCourse();
    const now = Date.now();
    const due = dueCards(deck.cards, { now }).length;
    const hasCards = deck.cards.length > 0;

    const synced = course
      ? `lesson list synced ${new Date(course.syncedAt).toLocaleDateString()}`
      : "lesson list not synced";
    console.log(`\n${chalk.bold("Study")}  ${chalk.gray(`${plural(deck.cards.length, "card")} · ${due} due · ${synced}`)}`);

    // Unavailable actions are left out rather than disabled: inquirer lets the
    // cursor land on disabled items. The first item is the most useful one.
    const choices = [
      due > 0 && { name: `Review due cards (${due})`, value: "review" },
      { name: "Add words", value: "add" },
      hasCards && { name: "Browse cards", value: "browse" },
      { name: "Export study notes (Markdown)", value: "notes" },
      hasCards && { name: "Export flashcards for Anki", value: "anki" },
      hasCards && { name: "Back up cards (JSON)", value: "backup" },
      { name: "Import cards from a backup", value: "import" },
      { name: course ? "Re-sync lesson list" : "Sync lesson list from ED22", value: "sync" },
      { name: "Back", value: "back" },
    ].filter(Boolean);

    const action = await select({ message: "Study", choices });

    if (action === "back") return;
    if (action === "review") await runReview(deck, { save: saveDeck });
    if (action === "add") await addWords(course);
    if (action === "browse") await browse();
    if (action === "sync") await sync();
    if (action === "notes") {
      await exportFile("ed22-study-notes.md", toStudyNotes(course, deck.cards, { now }));
    }
    if (action === "import") await importBackup();
    if (action === "backup") {
      await exportFile("ed22-flashcards.json", JSON.stringify(deck, null, 2),
        "Import this file in the web app or on another computer to continue where you left off.");
    }
    if (action === "anki") {
      await exportFile("ed22-flashcards.txt", toAnkiTsv(deck.cards),
        "In Anki: File › Import and pick this file. Fields and tags are set automatically.");
    }
  }
}
