import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { SESSION_MAX_AGE_MS } from "@ed22/core";
import { clearSession, loadSession, saveSession } from "../src/auth/session-store.js";

let dir;
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "ed22-test-"));
  process.env.ED22_CONFIG_DIR = dir;
});
after(async () => {
  delete process.env.ED22_CONFIG_DIR;
  await rm(dir, { recursive: true, force: true });
});

test("saved session is owner-only and has no password field", async () => {
  await saveSession({ username: "67070000", token: "tok" });
  const file = path.join(dir, "session.json");

  if (process.platform !== "win32") {
    assert.equal((await stat(file)).mode & 0o777, 0o600);
  }
  const stored = JSON.parse(await readFile(file, "utf8"));
  assert.deepEqual(Object.keys(stored).sort(), ["savedAt", "token", "username"]);
});

test("loadSession flags expired tokens", async () => {
  await saveSession({ username: "67070000", token: "tok" }, { now: 0 });
  const session = await loadSession({ now: SESSION_MAX_AGE_MS + 1 });
  assert.equal(session.expired, true);
  assert.equal(session.username, "67070000");
});

test("corrupt or missing session files load as null", async () => {
  await writeFile(path.join(dir, "session.json"), "{not json");
  assert.equal(await loadSession(), null);
  await clearSession();
  assert.equal(await loadSession(), null);
});
