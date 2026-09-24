// Local stand-in for the ED22 API (with the same CORS behavior as the real
// one) plus a static server for a built copy of the web app. Test-only.
import { existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = fileURLToPath(new URL("../../../packages/core/test/fixtures/", import.meta.url));
export const TOKEN = "mock-token";
export const GOOD_PASSWORD = "70123";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

function listen(server, port) {
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

export async function startMockServers({ distDir, apiPort, appPort }) {
  const overview = JSON.parse(readFileSync(path.join(FIXTURES, "overview.json"), "utf8"));
  const lessons = JSON.parse(readFileSync(path.join(FIXTURES, "unit-tree.json"), "utf8"));
  const requests = [];

  const api = http.createServer((req, res) => {
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "",
      "access-control-allow-methods": req.headers["access-control-request-method"] ?? "",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const route = req.url.split("?")[0].replace(/^\/api\//, "");
      requests.push(`${req.method} ${route}`);
      const send = (status, payload = "") => {
        res.writeHead(status, { ...cors, "content-type": "application/json" });
        res.end(payload);
      };

      if (route === "Auth/ForceLogin/") {
        const { Password } = JSON.parse(body);
        return Password === GOOD_PASSWORD
          ? send(200, JSON.stringify({ UserInfo: { Token: TOKEN } }))
          : send(200, "{}");
      }
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401);
      if (route === "CourseTree/GetDefaultCourseProgress") {
        return send(200, JSON.stringify({ CourseProgressTree: overview }));
      }
      if (/^CourseTree\/GetUserNodeProgress\/\d+$/.test(route)) {
        // Unique lesson ids per unit, like real data.
        const unitId = JSON.parse(body || "[]")[0]?.ParticleId ?? 0;
        const children = lessons.map((lesson, i) => ({ ...lesson, NodeId: unitId * 10 + i }));
        return send(200, JSON.stringify([{ Children: children }]));
      }
      if (route === "Auth/Logout") return send(200, "true");
      return send(404);
    });
  });

  const app = http.createServer((req, res) => {
    let file = path.join(distDir, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(distDir) || !existsSync(file) || statSync(file).isDirectory()) {
      file = path.join(distDir, "index.html");
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });

  await Promise.all([listen(api, apiPort), listen(app, appPort)]);
  return {
    requests,
    close: () => Promise.all([api, app].map((s) => new Promise((r) => s.close(r)))),
  };
}
