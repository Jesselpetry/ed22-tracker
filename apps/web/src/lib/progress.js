// "done" | "none" | "progress" | "unknown": drives colors and status labels.
export function tone(percent) {
  if (percent === null || percent === undefined) return "unknown";
  if (percent >= 100) return "done";
  if (percent === 0) return "none";
  return "progress";
}
