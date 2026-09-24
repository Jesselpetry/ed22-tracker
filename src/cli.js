#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { select } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { ApiError, BlockedRequestError, createClient } from "./api/client.js";
import { getOverview, getUnitTree, LoginError } from "./api/ed22.js";
import { authenticate, signOut } from "./auth/session.js";
import { apiUrl, DEFAULT_API_URL } from "./config.js";
import { normalizeLessons, normalizeOverview, stepColumns } from "./progress/normalize.js";
import { pct, renderOverview, renderPending, renderUnit } from "./ui/render.js";

const HELP = `
${chalk.bold("ed22")} - read-only progress dashboard for KMITL English Discoveries

${chalk.bold("Usage")}
  ed22             interactive dashboard (plain summary when piped)
  ed22 logout      end the session on ED22 and delete the saved token

${chalk.bold("Options")}
  --json           print progress as JSON and exit
  --dump           save raw API responses to ./ed22-raw.json (for debugging)
  --fresh          ignore the saved session and sign in again
  --no-save        do not save the session token to disk
  -h, --help       show this help

${chalk.bold("Environment")}
  ED22_USERNAME, ED22_PASSWORD   skip the prompts (see .env.example)
`;

// Only the .env next to this package, never one from the current directory:
// a stray .env could otherwise point ED22_API_URL at another server.
function loadPackageEnv() {
  try {
    process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
  } catch {
    // No .env is the normal case.
  }
}

class Dashboard {
  constructor(client, overviewTree, username) {
    this.client = client;
    this.username = username;
    this.setOverview(overviewTree);
  }

  setOverview(tree) {
    this.overview = normalizeOverview(tree);
    this.lessonCache = new Map();
  }

  async lessonsFor(unit) {
    if (!this.lessonCache.has(unit.nodeId)) {
      const raw = await getUnitTree(this.client, unit);
      this.lessonCache.set(unit.nodeId, normalizeLessons(raw));
    }
    return this.lessonCache.get(unit.nodeId);
  }

  async allLessons(spinner) {
    const results = [];
    for (const [i, unit] of this.overview.units.entries()) {
      if (spinner) spinner.text = `Loading units ${i + 1}/${this.overview.units.length}…`;
      results.push({ unit, lessons: await this.lessonsFor(unit) });
    }
    return results;
  }

  async refresh() {
    this.setOverview(await getOverview(this.client));
  }
}

// ora loops forever on a TTY that reports 0 columns (some ptys/CI), and its
// default stdin discarding fights with inquirer prompts.
function createSpinner(options) {
  const enabled = Boolean(process.stderr.isTTY && process.stderr.columns);
  return ora({ stream: process.stderr, discardStdin: false, isEnabled: enabled, ...options });
}

async function withSpinner(text, fn, { silent = false } = {}) {
  const spinner = createSpinner({ text, isSilent: silent }).start();
  try {
    const result = await fn(spinner);
    spinner.stop();
    return result;
  } catch (err) {
    spinner.stop();
    throw err;
  }
}

async function runInteractive(dash) {
  console.log(`\n${renderOverview(dash.overview, dash)}\n`);

  for (;;) {
    const action = await select({
      message: "What next?",
      choices: [
        { name: "Open a unit", value: "unit" },
        { name: "Show pending lessons", value: "pending" },
        { name: "Refresh", value: "refresh" },
        { name: "Sign out and forget this device", value: "logout" },
        { name: "Quit", value: "quit" },
      ],
    });

    if (action === "quit") return;

    if (action === "logout") {
      await withSpinner("Signing out…", () => signOut(dash.client, dash.client));
      console.log(chalk.green("Signed out. Saved session deleted."));
      return;
    }

    if (action === "refresh") {
      await withSpinner("Refreshing…", () => dash.refresh());
      console.log(`\n${renderOverview(dash.overview, dash)}\n`);
      continue;
    }

    if (action === "pending") {
      const results = await withSpinner("Loading units…", (s) => dash.allLessons(s));
      console.log(`\n${renderPending(results)}\n`);
      continue;
    }

    const unit = await select({
      message: "Which unit?",
      pageSize: 12,
      choices: dash.overview.units.map((u) => ({
        name: `${pct(u.percent)}  ${u.name}`,
        value: u,
      })),
    });
    const lessons = await withSpinner(`Loading ${unit.name}…`, () => dash.lessonsFor(unit));
    console.log(`\n${renderUnit(unit, lessons, stepColumns(lessons))}\n`);
  }
}

async function runJson(dash) {
  const results = await dash.allLessons();
  const out = {
    username: dash.username,
    percent: dash.overview.percent,
    grade: dash.overview.grade,
    units: results.map(({ unit, lessons }) => ({ ...unit, lessons })),
  };
  console.log(JSON.stringify(out, null, 2));
}

async function runDump(client, overviewTree) {
  const overview = normalizeOverview(overviewTree);
  const units = [];
  for (const unit of overview.units) {
    units.push({ unit: unit.name, raw: await getUnitTree(client, unit) });
  }
  const file = "ed22-raw.json";
  await writeFile(file, JSON.stringify({ overview: overviewTree, units }, null, 2), { mode: 0o600 });
  console.error(chalk.green(`Raw responses saved to ${file}`));
}

async function main() {
  loadPackageEnv();

  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: "boolean", default: false },
      dump: { type: "boolean", default: false },
      fresh: { type: "boolean", default: false },
      "no-save": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  if (apiUrl() !== DEFAULT_API_URL) {
    console.error(chalk.yellow(`Using custom API URL: ${apiUrl()}`));
  }
  const baseClient = createClient({ baseUrl: apiUrl() });

  if (positionals[0] === "logout") {
    const had = await signOut(baseClient);
    console.log(had ? chalk.green("Signed out. Saved session deleted.") : "No saved session.");
    return;
  }
  if (positionals.length > 0) {
    throw new Error(`Unknown command: ${positionals[0]}. Run ed22 --help.`);
  }

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) && !values.json && !values.dump;
  const quiet = values.json;

  const spinner = createSpinner({ isSilent: quiet });
  const { client, overview, username, reused } = await authenticate(baseClient, {
    fresh: values.fresh,
    save: !values["no-save"],
    interactive: Boolean(process.stdin.isTTY) && !values.json,
    onStatus: (text) => spinner.start(text),
    onWarning: (text) => {
      spinner.stop();
      console.error(chalk.yellow(`! ${text}`));
    },
  }).finally(() => spinner.stop());

  if (!quiet && reused) console.error(chalk.gray(`Using saved session for ${username}. Run \`ed22 logout\` to forget it.`));

  if (values.dump) return runDump(client, overview);

  const dash = new Dashboard(client, overview, username);
  if (values.json) return runJson(dash);
  if (interactive) return runInteractive(dash);

  // Piped / non-TTY: print a one-shot summary.
  console.log(renderOverview(dash.overview, dash));
  console.log(`\n${renderPending(await dash.allLessons())}`);
}

main().catch((err) => {
  if (err?.name === "ExitPromptError") {
    process.exitCode = 130;
    return;
  }
  if (err instanceof ApiError && err.isAuthError) {
    console.error(chalk.red("Session expired. Run ed22 again to sign in."));
  } else if (err instanceof LoginError || err instanceof ApiError || err instanceof BlockedRequestError) {
    console.error(chalk.red(err.message));
  } else {
    console.error(chalk.red(err?.message ?? String(err)));
    if (process.env.DEBUG) console.error(err);
  }
  process.exitCode = 1;
});
