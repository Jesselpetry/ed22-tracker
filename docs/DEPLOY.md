# Deploying the web app

The web app is a static site (HTML, CSS, JS in `apps/web/dist`). It has no server and no environment secrets, so any static host works.

## Before going live

Going live means other students will type their ED22 password into a page you publish. They are trusting the code you deploy. Before the first release:

1. **Test with a real ED22 account.** Development and CI use a mock server with synthetic data. Sign in with your own account and check that units, lessons and step progress look right. The per-lesson `Progress` field is inferred from the overall total; if units show `?`, run `ed22 --dump` in the CLI and compare the raw data.
2. **Run the full check locally:** `npm run check && npm run e2e -w @ed22/web`.
3. **Protect the `main` branch** (Settings → Branches): require the CI checks to pass and require pull request review, so nobody (including a compromised account token) can push code straight to production.
4. **Enable private vulnerability reporting** (Settings → Code security).
5. Decide whether to tell your course coordinator or KMITL IT about the site. It is read-only and open source, but a site that asks for university credentials is worth being upfront about.

## GitHub Pages (recommended)

The repository includes a manual deploy workflow, [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml). It lints, runs all tests, runs the browser test, builds and publishes.

1. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Actions → "Deploy web app to GitHub Pages" → **Run workflow**.
3. The site appears at `https://<user>.github.io/ed22-tracker/`.

Redeploy by running the workflow again. Nothing deploys automatically on push.

## Other static hosts

| Setting | Value |
| --- | --- |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `apps/web/dist` |
| Node version | 22 (see `.nvmrc`) |

Works on Cloudflare Pages, Netlify and Vercel. The app uses hash routes (`#/study`), so no rewrite rules are needed.

If your host supports custom response headers, add these. They are stronger than the `<meta>` versions and also block framing at the browser level:

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src https://edwebservices2.engdis.com https://api.dictionaryapi.dev; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

## After deploying

- Open the site, sign in, and check the browser console for Content Security Policy errors.
- Keep Dependabot pull requests moving; the site is only as safe as its dependencies.
- If ED22 changes its API, the app shows errors rather than wrong data. Update `packages/core/src/ed22.js` and the allowlist in `client.js` together.
