# EverySecondLetter

Two-player word game built with .NET 8 Minimal API, PostgreSQL, and a React + Vite frontend.

## What This Repo Contains

- Backend API in C# (.NET 8) with SQL persistence.
- React frontend in frontend/, built into wwwroot/ for production serving.
- Gameplay logic for turn-based letter play, claim/dispute scoring, and automatic endgame.
- System tests (API + UI BDD) using Playwright + playwright-bdd.

## Tech Stack

- Backend: .NET 8 Minimal API, Npgsql, PostgreSQL
- Frontend: React 18, Vite, React Context
- Testing: Playwright, playwright-bdd

## Requirements

- .NET 8 SDK
- Node.js 18+
- PostgreSQL
- psql (optional but useful)

## Project Structure

```text
.
├── Program.cs
├── Services/
├── Gameplay/
├── sql/
├── wordlists/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   └── pages/
│   └── README.md
├── Testing/SystemTests/
└── wwwroot/
```

## Setup

### 1) Database

Create a PostgreSQL database (for example every_second_letter) and apply:

```bash
psql "<YOUR CONNECTION STRING>" -f sql/001_init.sql
```

### 2) Connection String

The app reads connection string from:

1. ConnectionStrings:Default
2. DATABASE_URL (fallback)

launchSettings.json includes local defaults, but DATABASE_URL can override.

## Run Modes

### Development (recommended)

Terminal 1:

```bash
cd frontend
npm install
npm run dev
```

Terminal 2:

```bash
dotnet run
```

Open http://localhost:5173. Vite proxies /games calls to http://localhost:5010.

### Production-like Local Run

```bash
cd frontend
npm install
npm run build
cd ..
dotnet run
```

Open http://localhost:5010.

## Frontend Notes (Consolidated)

- Frontend is React + Vite and builds to wwwroot/.
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

See the canonical rules document at [frontend/public/gameplay-and-rules.md](frontend/public/gameplay-and-rules.md).

## API Overview

- GET /health
- GET /client-ip
- POST /games
- POST /games/{id}/join
- GET /games/{id}
- POST /games/{id}/letter
- POST /games/{id}/claim
- POST /games/{id}/accept
- POST /games/{id}/dispute
- POST /games/{id}/validate-word

X-Player-Token requirements:

- Required for: /games/{id}/letter, /games/{id}/claim, /games/{id}/accept, /games/{id}/dispute
- Optional for: /games/{id}/join (used for rejoin behavior)

## Testing

Tests live in Testing/SystemTests and are split by project:

- api
- ui

Commands:

```bash
cd Testing/SystemTests
npm install
npm run test
npm run test:api
npm run test:ui
npm run test:headed
```

Notes:

- test and project runs regenerate BDD specs with bddgen.
- UI tests target baseURL http://localhost:5010.

## Troubleshooting

- 404 on deep link refresh:
  - Verify frontend build exists in wwwroot and SPA fallback is enabled.
- UI tests cannot connect:
  - Ensure backend is running on http://localhost:5010.
- Rejoin behavior not restoring state:
  - Clear sessionStorage/localStorage keys esl_player and esl_game, then register again.
- Frontend dependency issues:

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Related Docs

- TECH-DEBT.md

