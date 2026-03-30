# EverySecondLetter - Minimal Demo

A minimal two-player word game built with .NET 8 Minimal API and React + Vite. No database, no complex logic—just in-memory game storage and simple turn-based letter play.

## What This Repo Contains

- Minimal C# backend (110 LOC) with in-memory game storage via ConcurrentDictionary
- Single React component in Frontend/, built into Server/wwwroot/
- 4 simple endpoints: create game, join, fetch state, play letter
- Unit tests (xUnit) and basic API testing

## Tech Stack

- Backend: .NET 8 Minimal API, in-memory ConcurrentDictionary (no database)
- Frontend: React 18, Vite, sessionStorage for player persistence
- Testing: xUnit (unit tests), Newman API tests

## Requirements

- .NET 8 SDK
- Node.js 18+

## Project Structure

```text
.
├── Server/
│   ├── Program.cs (110 LOC, complete game rules here)
│   └── wwwroot/ (built frontend)
├── Frontend/
│   ├── src/
│   │   └── App.jsx (single component)
│   └── vite.config.js
└── Testing/
    └── UnitTests/ and SystemTests/
```

## Running the App

### Production (integrated frontend & backend)

```bash
cd Frontend
npm install
npm run build

cd ..
dotnet run --project Server/EverySecondLetter.csproj
```

Open http://127.0.0.1:5010

### Development (with hot reload)

Terminal 1 (Backend):
```bash
dotnet run --project Server/EverySecondLetter.csproj
```

Terminal 2 (Frontend):
```bash
cd Frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173 (Vite proxies /games calls to backend)

## API (4 Endpoints)

- `POST /games?playerName=Alice` — Create new game, returns gameId & playerId
- `POST /games/{gameId}/join?playerName=Bob` — Join existing game
- `GET /games/{gameId}` — Fetch current game state (word, players, turn)
- `POST /games/{gameId}/letter?playerId=...&letter=E` — Play next letter in your word

## Frontend

App.jsx is the only React component (~300 LOC):
- Reads/writes player data from sessionStorage
- Create game, join, display state, play letter
- Polls game state every 2 seconds for updates
- 10+ data-testid attributes for automated testing

## Testing

```bash
# Unit tests (xUnit)
dotnet test Testing/UnitTests/EverySecondLetter.UnitTests/

# API tests (Newman)
cd Testing/SystemTests
npm install
npm run test:api

# UI tests (Playwright BDD)
npm run test:ui
```

- **Unit Tests:** TurnRulesTests (turn order), MinimalContractsTests (data models)
- **API Tests:** Basic flow create → join → state → play
- **UI Tests:** One Gherkin scenario for complete gameplay flow

## Troubleshooting

- 404 on deep link refresh:
  - Verify frontend build exists in Server/wwwroot and SPA fallback (`MapFallbackToFile("index.html")`) is enabled in Program.cs.
- UI tests cannot connect:
  - Ensure backend is running on http://127.0.0.1:5010.
- Frontend rebuild needed:
  ```bash
  cd Frontend
  rm -rf dist node_modules package-lock.json
  npm install
  npm run build
  ```

## Related Docs

- TECH-DEBT.md

