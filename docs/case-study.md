# SignalStack Case Study

SignalStack is a product opportunity cockpit designed to show full-stack builder-engineer range in a compact, inspectable project.

## Product Problem

Small product teams often collect ideas, customer asks, experiments, and scoring notes across several tools. SignalStack turns those inputs into one ranked pipeline so a team can decide what to validate next.

## What The Project Demonstrates

- Full-stack app architecture with a React/Vite client and Express API.
- Session authentication with httpOnly cookies and a seeded demo user.
- SQLite persistence with relational tables for users, sessions, opportunities, experiments, and activity.
- Server-side validation and scoring logic instead of trusting the browser.
- A workflow UI that supports searching, filtering, creating opportunities, moving opportunities, and reading live metrics.
- Integration tests that exercise auth, protected routes, creation, persistence, scoring, and workflow movement.
- Deployment-ready production build where Express can serve the compiled client.

## Demo Account

- Email: `demo@signalstack.dev`
- Password: `builder-demo`

## Suggested Portfolio Framing

SignalStack is not a generic CRUD demo. It is a realistic internal product with a clear user workflow, computed business logic, persistent state, API tests, responsive UI, and production-minded packaging.

