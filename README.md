# ed22-tracker

A read-only progress dashboard for **KMITL English Discoveries (ED22)**, the FE1/FE2 e-learning portal at `ed22.engdis.com/thai`.

It shows your overall progress and grade, a breakdown per unit, and which lessons (and which steps within them) you still have to do. It **never** marks anything complete, submits answers, or reads answer data. See [How read-only is enforced](#how-read-only-is-enforced).

```
ED22 progress  67070123
████████████░░░░░░░░░░░░░░░░░░  42%   Grade C

┌───┬────────────────────────────┬──────────────────────┬──────┬───────┐
│ # │ Unit                       │ Progress             │      │ Grade │
├───┼────────────────────────────┼──────────────────────┼──────┼───────┤
│ 1 │ Unit 1: Everyday Life      │ ████████████████████ │ 100% │   A   │
│ 2 │ Unit 2: Science and Nature │ ██████████░░░░░░░░░░ │  50% │   –   │
│ 3 │ Unit 3: Media              │ █░░░░░░░░░░░░░░░░░░░ │   1% │   –   │
└───┴────────────────────────────┴──────────────────────┴──────┴───────┘

Unit 2: Science and Nature   50%  1/3 lessons complete
┌──────────────────┬─────────┬──────────┬──────┬───────┐
│ Lesson           │ Explore │ Practice │ Test │ Total │
├──────────────────┼─────────┼──────────┼──────┼───────┤
│ Recycling        │    ✓    │    ✓     │  ✓   │  100% │
│ Movie Making     │   1/2   │   0/2    │ 0/1  │   17% │
└──────────────────┴─────────┴──────────┴──────┴───────┘
```

## Install

Requires Node.js 20.12 or newer.

```bash
git clone https://github.com/Jesselpetry/ed22-tracker.git
cd ed22-tracker
npm install
npm link        # optional: makes the `ed22` command available everywhere
```

## Use

```bash
ed22             # interactive dashboard (or: npm start)
ed22 --json      # machine-readable progress, e.g. for scripts
ed22 logout      # end the ED22 session and delete the saved token
ed22 --help
```

The interactive dashboard lets you open a unit, list every pending lesson across all units, or refresh. When the output is piped (`ed22 | less`), it prints a one-off summary instead.

| Option | What it does |
| --- | --- |
| `--json` | Print progress as JSON and exit |
| `--fresh` | Ignore the saved session and sign in again |
| `--no-save` | Keep the session token in memory only |
| `--dump` | Save raw API responses to `./ed22-raw.json` for debugging |

## Credentials and sessions

- **Your password is never stored.** You type it into a masked prompt, or set `ED22_USERNAME` / `ED22_PASSWORD` in a `.env` file next to `package.json` (see `.env.example`; `.env` is git-ignored).
- **Only the session token is cached**, in `~/.config/ed22-tracker/session.json` (`%APPDATA%\ed22-tracker` on Windows). The file is created with owner-only permissions (`0600`) and is discarded after 12 hours or as soon as ED22 rejects it. Use `--no-save` to skip caching entirely.
- Reusing the token also means you are not signed out of an open ED22 browser tab every time you run the tool, since ED22's login endpoint ends other sessions.
- If your password is still the default (last 5 digits of your student ID), the tool warns you. Anyone who knows your ID can sign in as you, so change it on the ED22 site.
- Errors are reduced to a status code and a short message. Tokens and request headers are never printed.
- The API URL can be overridden with `ED22_API_URL` for local testing, but only over HTTPS (plain HTTP is allowed for `localhost` only). The `.env` file is loaded from this package's folder only, never from the directory you run the command in.

## How read-only is enforced

Every request goes through [`src/api/client.js`](src/api/client.js), which checks it against an allowlist **before** anything is sent:

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `Auth/ForceLogin` | Sign in (creates a session token) |
| `GET` | `Auth/Logout` | Sign out |
| `GET` | `CourseTree/GetDefaultCourseProgress` | Overall and per-unit progress |
| `POST` | `CourseTree/GetUserNodeProgress/{id}` | Lesson tree for one unit (the POST body is a filter; nothing is saved) |

Anything else, including `Progress/SetProgressPerTask`, `UserTestV1/SaveUserTest` and `practiceManager/GetItem`, throws `BlockedRequestError`. `test/client.test.js` checks this.

## Development

```bash
npm test
```

Tests use Node's built-in test runner and synthetic fixtures in `test/fixtures/`. No network access or real account is needed.

ED22 has no public API documentation. Per-node progress is read from each node's `Progress` field (a 0–1 fraction), the same field the site uses for the overall total. If a unit shows `?`, run `ed22 --dump` and check the raw response.

## Roadmap

- Offline study notes and flashcards generated from lesson reading and vocabulary content (lesson text only; no test or answer data)
- Optional local web UI

## Credits

- **[BossNz/auto-english-discovery](https://github.com/BossNz/auto-english-discovery)** by [BossNz](https://github.com/BossNz). The original research into the English Discoveries API that this project builds on: the endpoints, the KMITL institution ID, the course-tree structure and the progress-rounding rules.
- [DeltaLoam/auto-english-discovery](https://github.com/DeltaLoam/auto-english-discovery), a fork of BossNz's project, for the 2026 ED22 endpoint and community-version updates.

This project is a separate, read-only tool. It contains no automation code from those projects.

## Disclaimer

Unofficial. Not affiliated with, or endorsed by, KMITL, EF, or English Discoveries. Use it with your own account only and follow your institution's rules.

## License

[GPL-3.0](LICENSE), the same license as the upstream project.
