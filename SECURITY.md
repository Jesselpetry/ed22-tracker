# Security

ed22-tracker asks students for their ED22 password, so its security model is deliberately simple and checkable.

## How credentials and data are handled

| What | Where it goes | Where it is stored |
| --- | --- | --- |
| ED22 password | Sent once, over HTTPS, from your browser or terminal straight to `edwebservices2.engdis.com` | Nowhere. Never written to disk, browser storage or logs. |
| ED22 session token | Sent only to ED22, as a `Bearer` header | **Web:** `sessionStorage` (this tab) by default, `localStorage` only if you tick "Keep me signed in". **CLI:** `~/.config/ed22-tracker/session.json` with `0600` permissions, or memory only with `--no-save`. Dropped after 12 hours or on the first 401. |
| Course outline (unit/lesson names, progress) | Nowhere | Your browser's `localStorage` / the CLI config folder, for offline study mode |
| Flashcards | Nowhere (only the word you look up goes to `api.dictionaryapi.dev`) | Your browser's `localStorage` / the CLI config folder |

There is **no backend**. The web app is static files; ED22 allows cross-origin requests (`Access-Control-Allow-Origin: *`), so the browser talks to ED22 directly. Whoever hosts the site never receives passwords, tokens or progress data.

## Read-only enforcement

All ED22 traffic goes through [`packages/core/src/client.js`](packages/core/src/client.js), which checks each request against a four-route allowlist **before** it is sent:

- `POST Auth/ForceLogin` (sign in)
- `GET Auth/Logout`
- `GET CourseTree/GetDefaultCourseProgress`
- `POST CourseTree/GetUserNodeProgress/{id}` (a query; the body is a filter)

Anything else, including `Progress/SetProgressPerTask`, `UserTestV1/SaveUserTest` and `practiceManager/GetItem` (answer data), throws `BlockedRequestError`. Unit tests cover this, and the browser end-to-end test fails if the app ever calls a route outside the list.

## Web hardening

- **Content Security Policy** (build-time `<meta>`): `default-src 'none'`, scripts and styles from the site itself only, and `connect-src` limited to ED22 and the dictionary API. Even a compromised dependency could not send data to another server.
- No third-party scripts, fonts, analytics or CDNs.
- `referrer` set to `no-referrer`.
- The app refuses to run inside a frame (clickjacking), because static hosts such as GitHub Pages cannot send `frame-ancestors`.
- Plain-HTTP API URLs are refused except for `localhost` (used by tests).
- Errors shown to users are reduced to a status code and a short message; request headers and tokens are never logged.
- GitHub Actions are pinned to commit SHAs; Dependabot keeps npm packages and Actions up to date.

## Known limitations

- Signing in uses ED22's `ForceLogin` endpoint (the only login endpoint known to work), which ends ED22 sessions in other browser tabs.
- ED22 still uses the last 5 digits of the student ID as the default password. The app warns users who have not changed it.
- Anyone who can run JavaScript on the page (for example a malicious browser extension) can read what you type, as on any website.

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** (Security tab → "Report a vulnerability") rather than a public issue. Include steps to reproduce and the affected version or commit.
