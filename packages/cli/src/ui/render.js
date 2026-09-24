import chalk from "chalk";
import Table from "cli-table3";

const BAR_WIDTH = 20;

function colorFor(percent) {
  if (percent === null) return chalk.gray;
  if (percent >= 100) return chalk.green;
  if (percent >= 50) return chalk.yellow;
  return chalk.red;
}

export function bar(percent, width = BAR_WIDTH) {
  if (percent === null) return chalk.gray("·".repeat(width));
  // Same idea as toPercent: a started bar shows one block, an unfinished one is never full.
  const raw = Math.floor((percent / 100) * width);
  const filled = percent >= 100 ? width : Math.min(width - 1, Math.max(percent > 0 ? 1 : 0, raw));
  return colorFor(percent)("█".repeat(filled)) + chalk.gray("░".repeat(width - filled));
}

export function pct(percent) {
  if (percent === null) return chalk.gray("  ?");
  return colorFor(percent)(`${String(percent).padStart(3)}%`);
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function table(head, colAligns) {
  return new Table({
    head: head.map((h) => chalk.bold(h)),
    colAligns,
    style: { head: [], border: ["gray"] },
  });
}

export function renderOverview(overview, { username }) {
  const lines = [];
  const grade = overview.grade !== null ? `   Grade ${chalk.bold(overview.grade)}` : "";
  lines.push(`${chalk.bold("ED22 progress")}  ${chalk.gray(username)}`);
  lines.push(`${bar(overview.percent, 30)} ${pct(overview.percent)}${grade}`);
  lines.push("");

  const t = table(["#", "Unit", "Progress", "", "Grade"], ["right", "left", "left", "right", "center"]);
  overview.units.forEach((unit, i) => {
    t.push([
      chalk.gray(i + 1),
      truncate(unit.name, 40),
      bar(unit.percent),
      pct(unit.percent),
      unit.grade ?? chalk.gray("–"),
    ]);
  });
  lines.push(t.toString());
  return lines.join("\n");
}

function stepCell(step) {
  if (!step) return chalk.gray("–");
  if (step.percent === 100) return chalk.green("✓");
  if (step.done !== null && step.total > 0) {
    return colorFor(step.percent)(`${step.done}/${step.total}`);
  }
  return pct(step.percent).trim();
}

export function renderUnit(unit, lessons, columns, { pendingOnly = false } = {}) {
  const shown = pendingOnly ? lessons.filter((l) => l.pending) : lessons;
  const done = lessons.filter((l) => !l.pending).length;
  const header = `${chalk.bold(unit.name)}  ${pct(unit.percent)}  ${chalk.gray(`${done}/${lessons.length} lessons complete`)}`;

  if (shown.length === 0) {
    return `${header}\n${chalk.green("  Nothing pending in this unit.")}`;
  }

  const t = table(["Lesson", ...columns, "Total"], ["left", ...columns.map(() => "center"), "right"]);
  for (const lesson of shown) {
    const byName = new Map(lesson.steps.map((s) => [s.name, s]));
    t.push([
      lesson.pending ? truncate(lesson.name, 36) : chalk.gray(truncate(lesson.name, 36)),
      ...columns.map((c) => stepCell(byName.get(c))),
      pct(lesson.percent),
    ]);
  }
  return `${header}\n${t.toString()}`;
}

export function renderPending(results) {
  const lines = [];
  let total = 0;
  for (const { unit, lessons } of results) {
    const pending = lessons.filter((l) => l.pending);
    if (pending.length === 0) continue;
    total += pending.length;
    lines.push(chalk.bold(unit.name));
    for (const lesson of pending) {
      const todo = lesson.steps.filter((s) => s.percent !== 100).map((s) => s.name);
      const detail = todo.length ? chalk.gray(` (${todo.join(", ")})`) : "";
      lines.push(`  ${pct(lesson.percent)}  ${lesson.name}${detail}`);
    }
    lines.push("");
  }
  if (total === 0) return chalk.green("All lessons complete. Nice work.");
  lines.unshift(chalk.bold(`${total} lesson${total === 1 ? "" : "s"} pending`), "");
  return lines.join("\n").trimEnd();
}
