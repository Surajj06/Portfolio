# Suraj Jha — Portfolio (Frontend)

Angular 17 standalone application for the AI Engineer portfolio site.

## Run locally

```bash
npm install
npm start
```

Serves at `http://localhost:4201`. The backend API is expected at
`http://localhost:5000/api` in development (see `src/environments`).

## Build

```bash
npm run build
```

Output is written to `dist/suraj-jha-portfolio`.

## Editing content

Almost everything on the page — profile links, About text, experience,
projects, tech stack, and case studies — lives in one file:

```
src/app/services/portfolio-data.service.ts
```

Update the values there; no template changes are needed. Lines marked
`// TODO:` still need real information (GitHub/LinkedIn URLs, resume file,
company/duration details, measured project results).

Replace `src/assets/resume.pdf` with the real resume — the Resume section
and hero CTA both link to that path already.

## Structure

```
src/app/
  core/        navbar, footer
  shared/      section heading, tech card, icon set, scroll-reveal directive
  features/
    home/      one section component per part of the page
    project-detail/  case-study route (/projects/:id)
  services/    portfolio content + contact API client
  models/      TypeScript interfaces for content
```

## Notes

- No third-party icon or animation library — icons are inline SVG, motion
  is CSS/SVG-native and respects `prefers-reduced-motion`.
- The contact form posts to `POST /api/contact` on the backend in this repo.
