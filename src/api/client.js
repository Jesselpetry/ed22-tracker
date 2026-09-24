// Every request goes through `request`, which refuses any route not listed
// here before touching the network. Progress/, UserTestV1/ and
// practiceManager/ (answer data) are deliberately absent.
const READ_ONLY_ROUTES = [
  // Creates a session token. Does not change course data.
  { method: "POST", path: /^Auth\/ForceLogin\/?$/ },
  { method: "GET", path: /^Auth\/Logout\/?$/ },
  { method: "GET", path: /^CourseTree\/GetDefaultCourseProgress\/?$/ },
  // POST is used as a query here: the body is a node filter, nothing is saved.
  { method: "POST", path: /^CourseTree\/GetUserNodeProgress\/\d+\/?$/ },
];

export class ApiError extends Error {
  constructor(message, { status, route } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.route = route;
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }
}

export class BlockedRequestError extends Error {
  constructor(method, route) {
    super(`${method} ${route} is not on the read-only allowlist`);
    this.name = "BlockedRequestError";
  }
}

export function isAllowed(method, route) {
  return READ_ONLY_ROUTES.some((r) => r.method === method && r.path.test(route));
}

function assertSafeBaseUrl(baseUrl) {
  const url = new URL(baseUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) {
    throw new Error(`Refusing non-HTTPS API URL: ${url.origin}`);
  }
}

export function createClient({ baseUrl, token, fetchImpl = fetch, timeoutMs = 15_000 }) {
  assertSafeBaseUrl(baseUrl);
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  async function request(method, rawRoute, { body, query } = {}) {
    const route = rawRoute.replace(/^\/+/, "");
    if (!isAllowed(method, route)) throw new BlockedRequestError(method, route);

    const url = new URL(route, base);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, String(value));
    }

    const headers = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (token) headers.authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Never surface the underlying error object: it can carry request headers.
      const message = err?.name === "TimeoutError"
        ? "ED22 did not respond in time"
        : "Could not reach ED22 (network error)";
      throw new ApiError(message, { route });
    }

    if (!res.ok) {
      throw new ApiError(`ED22 returned HTTP ${res.status}`, { status: res.status, route });
    }

    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError("ED22 sent a response that is not JSON", { status: res.status, route });
    }
  }

  return {
    get: (route, opts) => request("GET", route, opts),
    post: (route, body, opts) => request("POST", route, { ...opts, body }),
    withToken: (newToken) => createClient({ baseUrl, token: newToken, fetchImpl, timeoutMs }),
  };
}
