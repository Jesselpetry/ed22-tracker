import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, BlockedRequestError, createClient, isAllowed } from "../src/client.js";

function recordingFetch(response = { ok: true, status: 200, text: async () => "{}" }) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return response;
  };
  return { calls, fetchImpl };
}

const BASE = "https://example.test/api/";

test("write endpoints are blocked before any network call", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = createClient({ baseUrl: BASE, token: "t", fetchImpl });

  const blocked = [
    () => client.post("Progress/SetProgressPerTask", { CourseId: 1, ItemId: 2 }),
    () => client.post("/UserTestV1/SaveUserTest/1/2/true", { a: [] }),
    () => client.get("/practiceManager/GetItem/1/code/25/0/7/"),
    () => client.get("CourseTree/GetUserNodeProgress/123"),
    () => client.post("CourseTree/GetDefaultCourseProgress"),
  ];
  for (const call of blocked) {
    await assert.rejects(call, BlockedRequestError);
  }
  assert.equal(calls.length, 0);
});

test("allowlisted routes reach fetch with bearer token", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = createClient({ baseUrl: BASE, token: "secret-token", fetchImpl });

  await client.get("/CourseTree/GetDefaultCourseProgress");
  await client.post("CourseTree/GetUserNodeProgress/9000", [{ ParticleId: 1 }]);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://example.test/api/CourseTree/GetDefaultCourseProgress");
  assert.equal(calls[0].init.headers.authorization, "Bearer secret-token");
  assert.equal(calls[1].init.method, "POST");
});

test("HTTP errors do not leak the token", async () => {
  const { fetchImpl } = recordingFetch({ ok: false, status: 401, text: async () => "" });
  const client = createClient({ baseUrl: BASE, token: "secret-token", fetchImpl });

  const err = await client.get("CourseTree/GetDefaultCourseProgress").catch((e) => e);
  assert.ok(err instanceof ApiError);
  assert.equal(err.isAuthError, true);
  assert.ok(!JSON.stringify({ ...err, message: err.message }).includes("secret-token"));
});

test("network failures are wrapped without the original error", async () => {
  const client = createClient({
    baseUrl: BASE,
    token: "secret-token",
    fetchImpl: async () => { throw Object.assign(new Error("boom secret-token"), { name: "TypeError" }); },
  });
  const err = await client.get("CourseTree/GetDefaultCourseProgress").catch((e) => e);
  assert.ok(err instanceof ApiError);
  assert.ok(!err.message.includes("secret-token"));
});

test("plain HTTP is refused except for localhost", () => {
  assert.throws(() => createClient({ baseUrl: "http://evil.test/api/" }), /non-HTTPS/);
  assert.doesNotThrow(() => createClient({ baseUrl: "http://127.0.0.1:4000/api/" }));
});

test("isAllowed matches method and path exactly", () => {
  assert.equal(isAllowed("GET", "Auth/Logout"), true);
  assert.equal(isAllowed("POST", "Auth/Logout"), false);
  assert.equal(isAllowed("POST", "CourseTree/GetUserNodeProgress/abc"), false);
});
