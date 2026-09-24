// End-to-end smoke test: builds the app against a local mock ED22, then
// drives it in Chrome through sign-in, progress, study, export and sign-out.
//
//   npm run e2e -w @ed22/web
//   CHROME_PATH=/path/to/chrome E2E_SCREENSHOTS=./shots npm run e2e -w @ed22/web
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { build } from "vite";
import { GOOD_PASSWORD, startMockServers, TOKEN } from "./mock-ed22.js";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const API_PORT = 4789;
const APP_PORT = 4790;
const APP = `http://127.0.0.1:${APP_PORT}/`;
const SHOTS = process.env.E2E_SCREENSHOTS;

// Only these ED22 routes may ever be called (mirrors the core allowlist).
const ALLOWED = [
  /^POST Auth\/ForceLogin\/$/,
  /^GET Auth\/Logout$/,
  /^GET CourseTree\/GetDefaultCourseProgress$/,
  /^POST CourseTree\/GetUserNodeProgress\/\d+$/,
];

const DICTIONARY_ENTRY = [{
  word: "sustainable",
  phonetics: [{ text: "/səˈsteɪnəbəl/" }],
  meanings: [{
    partOfSpeech: "adjective",
    definitions: [
      { definition: "Able to be maintained at a certain rate or level.", example: "sustainable economic growth" },
      { definition: "Conserving an ecological balance by avoiding depletion of natural resources." },
    ],
  }],
}];

const problems = [];
const check = (ok, message) => ok || problems.push(message);

async function main() {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "ed22-e2e-"));
  process.env.VITE_ED22_API_URL = `http://127.0.0.1:${API_PORT}/api/`;
  await build({ root: WEB_ROOT, logLevel: "warn", build: { outDir, emptyOutDir: true } });
  const csp = await readFile(path.join(outDir, "index.html"), "utf8");
  check(csp.includes(`connect-src http://127.0.0.1:${API_PORT} https://api.dictionaryapi.dev`), "CSP connect-src not set as expected");

  const servers = await startMockServers({ distDir: outDir, apiPort: API_PORT, appPort: APP_PORT });
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" });

  try {
    await run(browser);
  } finally {
    await browser.close();
    await servers.close();
    await rm(outDir, { recursive: true, force: true });
  }

  for (const request of servers.requests) {
    check(ALLOWED.some((rule) => rule.test(request)), `non-allowlisted request: ${request}`);
  }
  console.log(`ED22 requests: ${servers.requests.length}, all allowlisted: ${servers.requests.every((r) => ALLOWED.some((a) => a.test(r)))}`);
}

async function run(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "en-GB", colorScheme: "light", acceptDownloads: true });
  const page = await context.newPage();

  page.on("pageerror", (err) => problems.push(`page error: ${err.message}`));
  page.on("console", (msg) => {
    const text = msg.text();
    if (/Content Security Policy/i.test(text)) problems.push(`CSP violation: ${text}`);
    // The dictionary stub answers 404 for unknown words, exactly like the real API.
    else if (msg.type() === "error" && !/status of 404/.test(text)) problems.push(`console error: ${text}`);
  });

  await context.route("https://api.dictionaryapi.dev/**", (route) => {
    const word = decodeURIComponent(route.request().url().split("/").pop());
    const found = word === "sustainable";
    return route.fulfill({
      status: found ? 200 : 404,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(found ? DICTIONARY_ENTRY : { title: "No Definitions Found" }),
    });
  });

  const shot = async (name, p = page) => {
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, animations: "disabled" });
  };
  const step = (name) => console.log(`• ${name}`);
  const signInButton = page.getByRole("button", { name: "Sign in", exact: true });

  step("sign-in validation and errors");
  await page.goto(APP);
  await page.getByRole("heading", { name: "Sign in with your ED22 account" }).waitFor();
  await shot("01-login");
  await page.getByLabel("Student ID").fill("123");
  await signInButton.click();
  await page.getByText("Enter your 8-digit KMITL student ID.").waitFor();
  await page.getByLabel("Student ID").fill("67070123");
  await page.getByLabel("ED22 password").fill("wrong");
  await signInButton.click();
  await page.getByText("Student ID or password is incorrect.").waitFor();

  step("sign in (default password warning)");
  await page.getByLabel("ED22 password").fill(GOOD_PASSWORD);
  await signInButton.click();
  await page.getByRole("heading", { name: "Overall progress" }).waitFor();
  await page.getByText("You are using the default password.").waitFor();
  await page.getByText("1 of 5 units complete").waitFor();
  await shot("02-dashboard");

  step("unit detail and filter");
  await page.getByRole("link", { name: /Unit 2: Science and Nature/ }).click();
  await page.getByRole("heading", { name: "Unit 2: Science and Nature" }).waitFor();
  await page.getByText("Movie Making").waitFor();
  await shot("03-unit");
  await page.getByRole("button", { name: /To do/ }).click();
  check(await page.getByText("Recycling").count() === 0, "To do filter still shows a completed lesson");

  step("pending lessons");
  await page.getByRole("link", { name: "All units" }).click();
  await page.getByRole("link", { name: "See what's left" }).click();
  await page.getByText(/lessons to finish/).waitFor();
  await shot("04-pending");

  step("add words (dictionary hit, miss, duplicate)");
  await page.getByRole("link", { name: "Study" }).first().click();
  await page.getByText(/Synced .*5 units, 15 lessons/).waitFor();
  await page.getByRole("link", { name: /Add words/ }).click();
  await page.getByLabel("Word or phrase").fill("sustainable");
  await page.getByRole("button", { name: "Look up" }).click();
  await page.getByText("Able to be maintained at a certain rate or level.").waitFor();
  await shot("05-add-word");
  await page.getByRole("button", { name: "Save card" }).click();
  await page.getByText("Added “sustainable”.").waitFor();
  await page.getByLabel("Word or phrase").fill("recycle bin");
  await page.getByRole("button", { name: "Look up" }).click();
  await page.getByText("No dictionary entry found.", { exact: false }).waitFor();
  await page.getByLabel("Your meaning").fill("ถังรีไซเคิล");
  await page.getByRole("button", { name: "Save card" }).click();
  await page.getByText("Added “recycle bin”.").waitFor();
  await page.getByLabel("Word or phrase").fill("Sustainable");
  await page.getByText("This word is already saved for this lesson.").waitFor();

  step("review with keyboard");
  await page.goto(`${APP}#/study`);
  await page.getByRole("link", { name: "Review 2 cards" }).click();
  const flipAndRate = async (key, snap) => {
    await page.getByRole("button", { name: /Show answer/ }).waitFor();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: /Good/ }).waitFor();
    check(await page.locator(".flashcard-back").isVisible(), "answer not visible after flip");
    if (snap) await shot(snap);
    await page.keyboard.press(key);
  };
  await flipAndRate("1", "06-review");
  await flipAndRate("2");
  await flipAndRate("3");
  await page.getByText("Reviewed 2 · remembered 2 · again 1").waitFor();

  step("delete and undo");
  await page.goto(`${APP}#/study/cards`);
  await page.getByRole("button", { name: "Delete “recycle bin”" }).click();
  await page.getByText("1 card", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByText("2 cards", { exact: true }).waitFor();
  await shot("07-cards");

  step("exports and backup import");
  await page.goto(`${APP}#/study`);
  const download = async (name) => {
    const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name }).click()]);
    return readFile(await file.path(), "utf8");
  };
  check((await download("Study notes (.md)")).includes("| **sustainable** | adjective |"), "study notes missing card row");
  check((await download("Anki file (.txt)")).startsWith("#separator:tab"), "Anki export missing header");
  const backup = await download("Backup (.json)");
  check(JSON.parse(backup).cards.length === 2, "backup should hold 2 cards");
  await page.locator('input[type="file"]').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(backup) });
  await page.getByText("Imported 0 new cards, 0 updated.").waitFor();
  await shot("08-study");

  step("session survives reload");
  await page.goto(APP);
  await page.reload();
  await page.getByRole("heading", { name: "Overall progress" }).waitFor();

  step("Thai and dark theme");
  await page.getByRole("button", { name: "เปลี่ยนเป็นภาษาไทย" }).click();
  await page.getByRole("heading", { name: "ความคืบหน้ารวม" }).waitFor();
  await page.getByRole("button", { name: /ธีม/ }).click();
  await page.getByRole("button", { name: /ธีม/ }).click();
  await shot("09-dashboard-th-dark");
  await page.getByRole("button", { name: "Switch to English" }).click();

  step("mobile layout");
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    colorScheme: "dark", storageState: await context.storageState(),
  });
  const phone = await mobile.newPage();
  phone.on("pageerror", (err) => problems.push(`mobile page error: ${err.message}`));
  for (const route of ["#/study", "#/login", "#/study/cards"]) {
    await phone.goto(APP + route);
    await phone.getByRole("heading").first().waitFor();
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `horizontal scroll on mobile ${route}: ${overflow}px`);
  }
  await phone.goto(`${APP}#/study`);
  await shot("10-mobile-study", phone);
  await mobile.close();

  step("sign out clears the token");
  await page.getByRole("button", { name: /Sign out/ }).click();
  await page.getByRole("heading", { name: "Sign in with your ED22 account" }).waitFor();
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  check(!stored.includes(TOKEN), "token left in storage after sign-out");
  check(!stored.includes(GOOD_PASSWORD), "password found in storage");

  step("refuses to run in a frame");
  const framed = await context.newPage();
  await framed.setContent(`<iframe src="${APP}" width="600" height="300"></iframe>`);
  // The frame is cross-origin to the parent, so check from inside it.
  await framed.frames()[1].waitForFunction(() => document.body.textContent.includes("cannot be embedded"), null, { timeout: 5_000 })
    .catch(() => problems.push("frame guard did not trigger"));

  step("corrupt flashcard data shows recovery, not a crash");
  await page.evaluate(() => localStorage.setItem("ed22.deck", "{broken"));
  await page.goto(`${APP}#/study/add`);
  await page.reload();
  await page.getByText("Your saved flashcards could not be read.").waitFor();
  check(await page.evaluate(() => localStorage.getItem("ed22.deck")) === "{broken", "corrupt deck was overwritten");

  await context.close();
}

try {
  await main();
} catch (err) {
  problems.push(`crashed: ${err.stack ?? err}`);
}

if (problems.length) {
  console.error(`\nE2E FAILED:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("\nE2E passed");
