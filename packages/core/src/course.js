// Offline copy of the course outline (names and progress only). Study mode
// uses it to tag cards by lesson and to write study notes without signing in.
export function buildCourseOutline(overview, unitResults, { now = Date.now() } = {}) {
  return {
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
}

export function isCourseOutline(value) {
  return Number.isFinite(value?.syncedAt) && Array.isArray(value.units);
}
