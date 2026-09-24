// Turns raw ED22 course-tree nodes into plain view models.
// ED22 reports progress as a 0..1 fraction on `Progress`; nodes without it are
// treated as unknown (null) rather than 0 so the UI never invents numbers.

function readFraction(node) {
  const value = node?.Progress;
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.min(1, Math.max(0, value));
}

// Same rounding the ED22 site uses: never show 0% once started, never 100% until done.
export function toPercent(fraction) {
  if (fraction === null || fraction === undefined) return null;
  const value = fraction * 100;
  if (value > 0 && value < 1) return Math.ceil(value);
  if (value > 99 && value < 100) return Math.floor(value);
  return Math.round(value);
}

function children(node) {
  return Array.isArray(node?.Children) ? node.Children : [];
}

export function normalizeOverview(tree) {
  return {
    percent: toPercent(readFraction(tree)),
    grade: tree?.Grade ?? null,
    units: children(tree).map((unit) => ({
      nodeId: unit.NodeId,
      parentNodeId: unit.ParentNodeId,
      name: unit.Name ?? `Unit ${unit.NodeId}`,
      percent: toPercent(readFraction(unit)),
      grade: unit.Grade ?? null,
    })),
  };
}

function normalizeStep(step) {
  const tasks = children(step);
  const known = tasks.map(readFraction).filter((f) => f !== null);
  const done = known.filter((f) => f >= 1).length;
  const own = readFraction(step);
  const derived = known.length === tasks.length && tasks.length > 0 ? done / tasks.length : null;

  return {
    name: step.Name ?? "Step",
    isTest: String(step.Name).toLowerCase() === "test",
    percent: toPercent(own ?? derived),
    done: known.length === tasks.length ? done : null,
    total: tasks.length,
  };
}

export function normalizeLessons(lessonNodes) {
  return lessonNodes.map((lesson) => {
    const steps = children(lesson).map(normalizeStep);
    const stepPercents = steps.map((s) => s.percent);
    const derived = steps.length > 0 && stepPercents.every((p) => p !== null)
      ? stepPercents.reduce((a, b) => a + b, 0) / steps.length / 100
      : null;
    const percent = toPercent(readFraction(lesson) ?? derived);

    return {
      nodeId: lesson.NodeId,
      code: lesson.Metadata?.Code ?? null,
      name: lesson.Name ?? `Lesson ${lesson.NodeId}`,
      percent,
      steps,
      pending: percent === null || percent < 100,
    };
  });
}

// Unique step names in first-seen order, used as table columns.
export function stepColumns(lessons) {
  const names = [];
  for (const lesson of lessons) {
    for (const step of lesson.steps) {
      if (!names.includes(step.name)) names.push(step.name);
    }
  }
  return names;
}
