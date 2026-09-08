# Suraj Jha — AI Engineer Portfolio

A premium, dark-first personal portfolio: Angular 17 (standalone components,
TypeScript, SCSS) frontend, deployed as a single Vercel project.

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

**Frontend** (from `frontend`):
```bash
npm install
npm start
```
This talks to `http://localhost:5000/api` in dev
(`frontend/src/environments/environment.development.ts`) — the local ASP.NET
backend below, if you want to run one. Production
(`frontend/src/environments/environment.ts`) instead points at the
same-origin `/api` — the Vercel function — and needs no separate backend URL.

**Local ASP.NET backend** (optional, from `backend/PortfolioApi`):
```bash
dotnet restore
dotnet run
```

## Deploying (Vercel)

1. Import this repo into Vercel with **Root Directory set to `frontend`**.
   `frontend/vercel.json` already has the build command, output directory,
   and the SPA rewrite (`/projects/:id` etc. need to resolve to
   `index.html` on refresh — everything except `/api/*` is rewritten there).
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
3. Deploy. That's it — one project, one domain, frontend and contact form
   both live.

## Before you deploy

1. Edit `frontend/src/app/services/portfolio-data.service.ts` — every
   `// TODO:` marks a placeholder (GitHub/LinkedIn URLs, email, experience,
   project results, case-study details) that needs your real information.
2. Drop your real PDF at `frontend/src/assets/resume.pdf`.
3. Update the canonical/OG URLs in `frontend/src/index.html` and the
   `sitemap.xml` / `robots.txt` if the domain isn't `surajjha.dev`.

## Design system

Near-black base (`#07080c`) with a single violet→blue accent gradient used
deliberately (nodes, the active flow line, hover states) rather than
scattered throughout. Display type is Space Grotesk, body is Inter. The
node-and-connection motif from the hero's system diagram carries through the
architecture section, the experience timeline, and the case-study index
markers, so it reads as one considered idea rather than decoration repeated
per section. All diagrams are inline SVG/CSS — no stock imagery, no
generated illustrations, no icon-font dependency.
