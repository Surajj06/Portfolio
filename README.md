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
npm run build      # production build + prerender of every route + entry-script preload (≈15s)
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
3. (Optional) turn on the AI assistant — see **Assistant** below.
4. Push to `main`. That's it — one project, one domain, frontend, contact
   form and assistant all live.

## Assistant (the chat bubble, bottom-right)

A small animated launcher opens a compact chat that answers visitors' questions
about Suraj — projects, experience, skills, and how to contact him (it can share
his email, phone/WhatsApp, LinkedIn, GitHub and resume link).

**How it works (RAG):** `frontend/api/chat.ts` is a Vercel function in the same
project. On every question it (1) *retrieves* the most relevant facts from a
knowledge base built from `frontend/src/app/data/portfolio-content.ts` — the same
file the site renders, so the two can never disagree — using BM25 (`api/_rag.ts`),
(2) hands only those facts to a language model with strict instructions to answer
**only** from them (no guessing, off-topic requests politely declined, prompt
injection ignored), and (3) streams the reply back. Edit your content once and
both the site and the assistant update.

**Turn the model on** — add *one* of these in Vercel → Project → Settings →
Environment Variables (never commit keys), then redeploy:

| Variable | Provider (default model) |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude (`claude-haiku-4-5-20251001`) |
| `OPENAI_API_KEY` | OpenAI (`gpt-4o-mini`) |
| `GEMINI_API_KEY` | Google Gemini via its OpenAI-compatible endpoint (`gemini-2.5-flash`) |
| `GROQ_API_KEY` | Groq (`llama-3.1-8b-instant`) |

Optional: `CHAT_MODEL` (override the model name), `OPENAI_BASE_URL` /
`ANTHROPIC_BASE_URL` (another compatible host), `CHAT_ALLOWED_ORIGINS` (extra
browser origins, comma-separated).

**With no key set the assistant still works** — it answers directly from the
retrieved facts (shows contact details, project summaries with case-study links,
politely refuses unrelated questions); it just isn't as conversational. If the
model is ever unreachable it falls back to the same mode, so visitors never hit a
dead end.

**Safety & cost:** same-origin only (a foreign `Origin` gets a 403), message
length/turn caps, a per-IP rate limit (10/minute, 60/hour — best-effort, per
instance), a capped reply length, no tools, and reply text is rendered through a
small safe formatter (never `innerHTML`). A small model such as Haiku costs a
fraction of a cent per chat; set a monthly spend limit with your provider as the
real backstop.

## Live 3D project covers

Each project card and case-study header is a small CSS-3D scene
(`shared/project-scene/`): pure CSS (`preserve-3d`, compositor-only animation),
sized in `em` so it scales to any card, tilted by the pointer, mounted only when
the card is about to scroll into view and **frozen while off-screen**. The SVG
illustration (`shared/project-art/`) is what the server renders and what lite
mode / old browsers fall back to. New projects get a generic scene until you add
a `@case` for them in `project-scene.component.html` (plus its stylesheet block).

## Editing content

- **All copy lives in** `frontend/src/app/data/portfolio-content.ts`
  (profile, about, experience, projects + case studies, tech stack) — a plain
  data file shared by the site and the chat assistant. The per-project highlight
  numbers (`PROJECT_META`, at the top of that file) are quoted from each case
  study — keep them in step with it. UI-only bits (nav, marquee, the demo call)
  stay in `services/portfolio-data.service.ts`.
- `profile.location` / `timezone` feed the live-clock tiles — edit if the
  default (India / IST) isn't right.
- **Adding a project:** add it to `baseProjects`, give it an entry in
  `PROJECT_META`, add a cover-art case in
  `frontend/src/app/shared/project-art/` (and, for a bespoke 3D cover, a case in
  `shared/project-scene/`), and add its route to
  `frontend/routes.txt` (prerender) and `frontend/src/sitemap.xml`.
- Resume: replace `frontend/src/assets/resume.pdf`. It always downloads as
  `Suraj_resume.pdf` (`profile.resumeFileName`; `vercel.json` sets the same name
  for direct visits).
- Canonical/OG URLs live in `frontend/src/index.html`, `sitemap.xml` and
  `robots.txt`.

## How it stays fast

- **Prerendered**: every route ships as real HTML, so content paints before
  any JavaScript runs; Angular then hydrates it.
- **Light initial JS (~127 KB transferred)**. GSAP (SplitText, Flip, ScrambleText) and Motion are code-split and only fetched once the page
  is idle — never on the server, in lite mode, or under reduced motion.
- **Animations stay on the compositor** (`transform`/`opacity`, individual
  `translate`/`rotate`/`scale` properties); ambient loops and the 3D covers pause
  when off-screen; scroll work is one shared passive listener that never reads
  layout.
- **Nothing runs a permanent `requestAnimationFrame` loop.** A pending rAF makes
  the browser run its whole render pipeline every frame, forever — the waveform
  canvases now only tick while visible, and GSAP's ScrollTrigger (which keeps such
  a loop alive) isn't used at all. Idle CPU on the page is ~0.
- **Section links** (`appSection`) are real `href="/#…"` links that scroll in
  place and land below the nav; long trips hop close to the target first so the
  sections in between are never painted at speed.
- **Adaptive "lite" mode** (`PerfGuardService`): weak devices (or ones that
  measurably can't hold frame rate) drop decorative effects automatically.
  Force it with `?lite=1`, or force the full experience with `?lite=0`.
- Fonts (Bricolage Grotesque variable, Instrument Serif Italic) are
  self-hosted via `@fontsource` — no third-party requests.
- The assistant and the 3D scenes are lazy chunks loaded when idle / near the viewport.
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
