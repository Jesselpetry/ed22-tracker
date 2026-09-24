// Anki: plain-text import with file headers (Anki 2.1.54+). Tags are
// hierarchical, e.g. ED22::Unit_2_Science_and_Nature::Recycling.

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function oneLine(text) {
  return String(text).replace(/[\t\r\n]+/g, " ").trim();
}

function tagPart(text) {
  return oneLine(text).replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "_");
}

export function cardTags(card) {
  const parts = ["ED22", card.unit, card.lesson].filter(Boolean).map(tagPart).filter(Boolean);
  return parts.join("::");
}

export function toAnkiTsv(cards) {
  const lines = ["#separator:tab", "#html:true", "#tags column:3"];
  for (const card of cards) {
    const front = escapeHtml(oneLine(card.front))
      + (card.phonetic ? ` <span style="color:gray">${escapeHtml(oneLine(card.phonetic))}</span>` : "");
    let back = escapeHtml(oneLine(card.back));
    if (card.partOfSpeech) back = `<i>${escapeHtml(oneLine(card.partOfSpeech))}</i> ${back}`;
    if (card.example) back += `<br><br><i>&ldquo;${escapeHtml(oneLine(card.example))}&rdquo;</i>`;
    lines.push([front, back, cardTags(card)].join("\t"));
  }
  return `${lines.join("\n")}\n`;
}

function mdCell(text) {
  return text ? oneLine(text).replace(/\|/g, "\\|") : "";
}

function cardTable(cards) {
  const rows = cards.map((c) => `| **${mdCell(c.front)}** | ${mdCell(c.partOfSpeech)} | ${mdCell(c.back)} | ${c.example ? `_${mdCell(c.example)}_` : ""} |`);
  return ["| Word | Type | Meaning | Example |", "| --- | --- | --- | --- |", ...rows].join("\n");
}

function formatDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function lessonHeading(lesson) {
  if (!lesson.pending) return `### ${lesson.name} ✓`;
  const pct = lesson.percent === null ? "?" : `${lesson.percent}%`;
  const todo = lesson.todo?.length ? ` · to do: ${lesson.todo.join(", ")}` : "";
  return `### ${lesson.name} (${pct}${todo})`;
}

// One Markdown study guide: every unit and lesson from the synced outline,
// the cards saved for each lesson, and cards not tied to any lesson at the end.
export function toStudyNotes(course, cards, { now = Date.now() } = {}) {
  const out = ["# ED22 study notes", ""];
  const meta = [`Generated ${formatDate(now)}`];
  if (course) {
    meta.push(`progress synced ${formatDate(course.syncedAt)}`);
    if (course.percent !== null) meta.push(`${course.percent}% overall`);
    if (course.grade) meta.push(`grade ${course.grade}`);
  }
  out.push(`_${meta.join(" · ")}_`, "");

  const used = new Set();
  for (const unit of course?.units ?? []) {
    const pending = unit.lessons.filter((l) => l.pending).length;
    out.push(`## ${unit.name}`, "");
    out.push(pending ? `${pending} of ${unit.lessons.length} lessons still to do.` : "All lessons complete.", "");

    for (const lesson of unit.lessons) {
      const lessonCards = cards.filter((c) => c.lessonNodeId === lesson.nodeId);
      lessonCards.forEach((c) => used.add(c.id));
      out.push(lessonHeading(lesson), "");
      out.push(lessonCards.length ? cardTable(lessonCards) : "_No vocabulary saved yet._", "");
    }
  }

  const rest = cards.filter((c) => !used.has(c.id));
  if (rest.length) {
    out.push(course ? "## Other vocabulary" : "## Vocabulary", "", cardTable(rest), "");
  }
  if (!course && !rest.length) {
    out.push("_Nothing yet. Sync your lesson list and add some words first._", "");
  }
  return out.join("\n");
}
