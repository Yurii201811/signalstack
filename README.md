# SignalStack

SignalStack is a portfolio-grade full-stack app for product teams that need to capture opportunities, score them, move them through a validation pipeline, and see portfolio-level metrics.

It is built as a practical builder-engineer showcase: real auth, API validation, SQLite persistence, computed scoring, seeded demo data, responsive React UI, tests, and production build scripts.

## Demo Login

- Email: `demo@signalstack.dev`
- Password: `builder-demo`

## What You Can Do

- Sign in to a seeded demo workspace.
- Search and filter opportunities by stage.
- Create a new opportunity with impact, confidence, effort, reach, owner, date, and tags.
- Move opportunities through the workflow.
- See live metrics, recent activity, experiments, and a recommended next action.
- Run API integration tests against an isolated in-memory database.

## Tech Stack

- React 18 and Vite for the frontend.
- Express for the backend API.
- SQLite via Node's built-in `node:sqlite` module for local persistence.
- httpOnly cookie sessions for authentication.
- Zod for request validation.
- Vitest and Supertest for API verification.

Tested with Node `25.4.0`. Use a recent Node release that includes `node:sqlite`.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The API runs on `http://localhost:4000`, and Vite proxies `/api` requests during development.

## Production Build

```bash
npm run build
npm start
```

Open `http://localhost:4000`.

The production server serves both the API and the compiled frontend from one Express app.

## Verification

```bash
npm audit
npm run lint
npm test
npm run build
```

Browser-verified screenshots are saved in `outputs/`.

## Project Structure

```text
src/
  client/        React app, API client, styles
  server/        Express app, auth, SQLite setup, repositories
  shared/        Shared TypeScript types
tests/           API integration tests
docs/            Portfolio case-study notes
design/          Generated visual concept used as design evidence
```

## Portfolio Notes

See [docs/case-study.md](docs/case-study.md) for a concise case-study writeup you can adapt for a portfolio page.
