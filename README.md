# Suraj Jha — AI Engineer Portfolio

A fast, Gen-Z-flavoured personal portfolio: Angular 17 (standalone components,
signals, TypeScript, SCSS), prerendered to static HTML at build time and
deployed as a single Vercel project.

```
suraj-portfolio/
  frontend/   Angular app + api/contact.ts (Vercel serverless function)
  backend/    ASP.NET Core Web API — optional, local-dev-only (see below)
```

**Production contact form** is a Vercel serverless function at
`frontend/api/contact.ts` — same project, same domain as the frontend, no
CORS, nothing extra to host. `backend/PortfolioApi` is the original ASP.NET
Core implementation of the same endpoint, kept in the repo only so you can
still run/test against a real .NET API locally if you want to; it is not
part of the deployed site.

## Quick start

Needs Node.js 20+ (22 or 24 are fine).

**Frontend** (from `frontend`):
```bash
npm install
npm start          # dev server on http://localhost:4201
npm run build      # production build + prerender of every route (≈15s)
```
The dev server talks to `http://localhost:5000/api`
(`frontend/src/environments/environment.development.ts`) — the local ASP.NET
backend below, if you want to run one. Production
(`frontend/src/environments/environment.ts`) points at the same-origin `/api`
— the Vercel function — and needs no separate backend URL.

To check the real production output locally, serve
`frontend/dist/suraj-jha-portfolio/browser` with any static server that falls
back to `index.html` for unknown paths.

**Local ASP.NET backend** (optional, from `backend/PortfolioApi`):
```bash
dotnet restore
dotnet run
```

## Deploying (Vercel)

1. Import this repo into Vercel with **Root Directory set to `frontend`**.
   `frontend/vercel.json` already has the build command (`npm run build`,
   which also prerenders), the output directory, the SPA rewrite, and
   long-lived caching for the hashed JS/CSS/font files.
2. Set these environment variables on the Vercel project (Settings →
   Environment Variables) — used by `frontend/api/contact.ts`:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (`"true"`/`"false"`)
   - `SMTP_USERNAME`, `SMTP_PASSWORD` — a Gmail **App Password**, not your
     real account password, if using Gmail SMTP
   - `SMTP_FROM_ADDRESS`
   - `CONTACT_EMAIL`, `CONTACT_DISPLAY_NAME`
   Until these are set, the function logs submissions instead of emailing
   them (so nothing is silently lost, but nothing arrives in your inbox
   either) — same fallback behavior the ASP.NET version had.
3. Push to `main`. That's it — one project, one domain, frontend and contact
   form both live.

## Editing content

- **All copy lives in** `frontend/src/app/services/portfolio-data.service.ts`
  (profile, about, experience, projects + case studies, tech stack). The
  per-project highlight numbers (`PROJECT_META`, at the top of that file) are
  quoted from each case study — keep them in step with it.
- `profile.location` / `timezone` feed the live-clock tiles — edit if the
  default (India / IST) isn't right.
- **Adding a project:** add it to `baseProjects`, give it an entry in
  `PROJECT_META`, add a cover-art case in
  `frontend/src/app/shared/project-art/`, and add its route to
  `frontend/routes.txt` (prerender) and `frontend/src/sitemap.xml`.
- Résumé: replace `frontend/src/assets/resume.pdf`.
- Canonical/OG URLs live in `frontend/src/index.html`, `sitemap.xml` and
  `robots.txt`.

## How it stays fast

- **Prerendered**: every route ships as real HTML, so content paints before
  any JavaScript runs; Angular then hydrates it.
- **Light initial JS (~126 KB transferred)**. GSAP (ScrollTrigger, SplitText,
  Flip, ScrambleText) and Motion are code-split and only fetched once the page
  is idle — never on the server, in lite mode, or under reduced motion.
- **Animations stay on the compositor** (`transform`/`opacity`, individual
  `translate`/`rotate`/`scale` properties); ambient loops pause when off-screen;
  scroll work is one shared passive listener that never reads layout.
- **Adaptive "lite" mode** (`PerfGuardService`): weak devices (or ones that
  measurably can't hold frame rate) drop decorative effects automatically.
  Force it with `?lite=1`, or force the full experience with `?lite=0`.
- Fonts (Bricolage Grotesque variable, Instrument Serif Italic) are
  self-hosted via `@fontsource` — no third-party requests.
- Everything respects `prefers-reduced-motion`, and the page works with
  JavaScript disabled (content is plain HTML).

## Design system

Near-black canvas (`#09090a`), warm off-white ink that echoes the portrait's
cream backdrop, and one acid-lime accent used on purpose. Light theme flips
the accent to ink and uses lime as a highlighter. Tokens live in
`frontend/src/styles/_tokens.scss`; shared primitives (buttons, chips, cards,
type roles) in `_ui.scss`; motion keyframes and scroll-reveal states in
`_motion.scss`. Display type mixes a chunky grotesque with an editorial serif
italic for one or two accent words per heading. Project covers are original
inline-SVG illustrations (the codebases are private, so there are no
screenshots) coloured by a per-project accent.
