import ora from "ora";

// ora loops forever on a TTY that reports 0 columns (some ptys/CI), and its
// default stdin discarding fights with inquirer prompts.
export function createSpinner(options) {
  const enabled = Boolean(process.stderr.isTTY && process.stderr.columns);
  return ora({ stream: process.stderr, discardStdin: false, isEnabled: enabled, ...options });
}

export async function withSpinner(text, fn, { silent = false } = {}) {
  const spinner = createSpinner({ text, isSilent: silent }).start();
  try {
    return await fn(spinner);
  } finally {
    spinner.stop();
  }
}
