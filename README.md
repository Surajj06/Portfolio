# Suraj Jha — AI Engineer Portfolio

A premium, dark-first personal portfolio: Angular 17 (standalone components,
TypeScript, SCSS) frontend + ASP.NET Core 8 Web API (C#) backend, kept in
clearly separated projects so they build and deploy independently.

```
suraj-portfolio/
  frontend/   Angular app — see frontend/README.md
  backend/    ASP.NET Core Web API — see backend/PortfolioApi/README.md
```

## Quick start

**Backend** (from `backend/PortfolioApi`):
```bash
dotnet restore
dotnet run
```

**Frontend** (from `frontend`):
```bash
npm install
npm start
```

The frontend expects the API at `http://localhost:5000/api` in development
(`frontend/src/environments/environment.development.ts`) and at
`https://api.surajjha.dev/api` in production
(`frontend/src/environments/environment.ts`) — update both to match your
actual API domain.

## Before you deploy

1. Edit `frontend/src/app/services/portfolio-data.service.ts` — every
   `// TODO:` marks a placeholder (GitHub/LinkedIn URLs, email, experience,
   project results, case-study details) that needs your real information.
2. Drop your real PDF at `frontend/src/assets/resume.pdf`.
3. Set the backend's SMTP and CORS values as **environment variables** on
   your host — never in a committed `appsettings.json`. See
   `backend/PortfolioApi/README.md` for the full list.
4. Update the canonical/OG URLs in `frontend/src/index.html` and the
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
