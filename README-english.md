# EverySecondLetter

Two-player word game built with .NET 8 Minimal API, PostgreSQL or SQLite, and a React + Vite frontend.

## What This Repo Contains

- Backend API in C# (.NET 8) with SQL persistence.
- React frontend in Frontend/, built into Server/wwwroot/ for production serving.
- Gameplay logic for turn-based letter play, claim/dispute scoring, and automatic endgame.
- System tests using Postman/Newman (API) and Playwright + playwright-bdd (UI).

## Tech Stack

- Backend: .NET 8 Minimal API, provider-based SQL access (PostgreSQL/SQLite)
- Frontend: React 18, Vite, React Context
- Testing: Postman/Newman (API), Playwright + playwright-bdd (UI)

## Requirements

- .NET 8 SDK
- Node.js 18+
- PostgreSQL or SQLite
- psql (optional but useful)

## Project Structure

```text
.
├── Server/
│   ├── Program.cs
│   ├── Services/
│   ├── Gameplay/
│   ├── wordlists/
│   └── wwwroot/
├── Frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   └── pages/
│   └── vite.config.js
└── Testing/SystemTests/
```

## Setup

### 1) Database

Create a PostgreSQL database (for example every_second_letter).

The application initializes and updates required tables automatically on startup.

### 2) Connection String

The app reads connection string from:

1. ConnectionStrings:Default
2. DATABASE_URL (fallback)

launchSettings.json includes local defaults, but DATABASE_URL can override.

### 3) Provider Switching (Postgres or SQLite)

You can switch provider via either environment variables or config.

Resolution order:

1. ConnectionStrings:Default
2. DATABASE_URL
3. DB_PROVIDER + SQLITE_PATH (SQLite mode)

If nothing is set, the default fallback provider is SQLite.

Recommended usage:

- Local development: environment variables
- Shared/stable setup: config file (ConnectionStrings:Default)
- CI/deploy: environment variables

Use SQLite via env:

```bash
export DB_PROVIDER=sqlite
export SQLITE_PATH=every_second_letter.db
dotnet run --project Server/EverySecondLetter.csproj
```

Use Postgres via env:

```bash
export DB_PROVIDER=postgres
export DATABASE_URL=postgres://user:pass@host:5432/db
dotnet run --project Server/EverySecondLetter.csproj
```

Use config file:

- Set ConnectionStrings:Default to either:
  - Postgres connection string, or
  - SQLite connection string, for example: Data Source=every_second_letter.db

## Run Modes

### Development (recommended)

Terminal 1:

```bash
cd Frontend
npm install
npm run dev
```

Terminal 2:

```bash
dotnet run --project Server/EverySecondLetter.csproj
```

Open http://localhost:5173. Vite proxies /games calls to http://localhost:5010.

### Production-like Local Run

```bash
cd Frontend
npm install
npm run build
cd ..
dotnet run --project Server/EverySecondLetter.csproj
```

Open http://localhost:5010.

## Frontend Notes (Consolidated)

- Frontend is React + Vite and builds to Server/wwwroot/.
- SPA fallback middleware in Program.cs rewrites non-API, non-file routes to /index.html.
- Main pages:
  - RegisterPage
  - CreateGamePage
  - JoinGamePage
  - GamePage
- Core UI components:
  - WordDisplay
  - ScoreBoard
  - GameControls
- State is managed in GameContext via useGame().
- Persistence is sessionStorage-first, with localStorage fallback for legacy data migration.
- Game polling currently runs every 1000ms on GamePage.

## Gameplay Rules

See the canonical rules document at [Frontend/public/gameplay-and-rules.md](Frontend/public/gameplay-and-rules.md).

## API Overview

- Swagger UI: http://localhost:5010/swagger
- GET /health
- GET /client-ip
- POST /games
- POST /games/{id}/join
- POST /games/{id}/start
- GET /games/{id}
- POST /games/{id}/letter
- POST /games/{id}/claim
- POST /games/{id}/accept
- POST /games/{id}/dispute
- POST /games/{id}/validate-word

X-Player-Token requirements:

- Required for: /games/{id}/start, /games/{id}/letter, /games/{id}/claim, /games/{id}/accept, /games/{id}/dispute
- Optional for: /games/{id}/join (used for rejoin behavior)

Notes:

- The current EverySecondLetter game still auto-starts when enough players have joined.
- The start endpoint exists to support future manual-start game variants built on the same concrete word-game core.

## Testing

Tests live in Testing/SystemTests and are split by project:

- api
- ui

Unit tests live in Testing/UnitTests/EverySecondLetter.UnitTests and run with xUnit.

Commands:

```bash
cd Testing/SystemTests
npm install
npm run test
npm run test:api
npm run test:ui
npm run test:headed
dotnet test ../UnitTests/EverySecondLetter.UnitTests/EverySecondLetter.UnitTests.csproj
```

Notes:

- API tests run with Newman using the Postman collection in Testing/SystemTests/postman/.
- Only UI test runs regenerate BDD specs with bddgen.
- UI tests target baseURL http://localhost:5010.

## Troubleshooting

- 404 on deep link refresh:
  - Verify frontend build exists in Server/wwwroot and SPA fallback is enabled.
- UI tests cannot connect:
  - Ensure backend is running on http://localhost:5010.
- Rejoin behavior not restoring state:
  - Clear sessionStorage/localStorage keys esl_player and esl_game, then register again.
- Frontend dependency issues:

```bash
cd Frontend
rm -rf node_modules package-lock.json
npm install
```

## Render Deployment

The app is deployed to [Render](https://render.com) as a Docker-based web service.

### How it works

- **Single Docker container** runs the ASP.NET Core app, which also serves the React frontend as static files from `wwwroot`.
- The `Dockerfile` is a multi-stage build: Node 22 builds the React frontend first, then .NET 8 SDK builds and publishes the backend, and finally the minimal ASP.NET runtime image is used.
- Render sets a `PORT` environment variable at runtime. The container reads it via `ASPNETCORE_URLS=http://+:${PORT}`.

### CI/CD

The `.github/workflows/deploy-render.yml` workflow runs on every push to `publish` and:
1. Builds the React frontend (output goes into `Server/wwwroot`)
2. Runs all .NET unit tests
3. Validates the Docker build
4. Triggers a Render deploy via the deploy hook stored in the `RENDER_DEPLOY_HOOK_URL` GitHub secret

To set up the deploy hook, go to your Render service → **Settings → Deploy Hook**, copy the URL, and add it as a secret in your GitHub repo settings.

### SQLite on Render

The app uses SQLite by default. Render's filesystem is **ephemeral** — the database is reset on every restart or redeploy. This is intentional for this project; the app seeds its schema automatically on startup.

If persistence is ever needed, configure a [Render Persistent Disk](https://render.com/docs/disks) (paid plans) and set the `SQLITE_PATH` environment variable to a path on the mounted disk (e.g. `/data/every_second_letter.db`).

## Related Docs

- TECH-DEBT.md

