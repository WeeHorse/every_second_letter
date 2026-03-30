# EverySecondLetter - Minimal Demo

En minimal två-spelares ordspel byggd med .NET 8 Minimal API och React + Vite. Ingen databas, ingen komplex logik—bara in-memory spellagring och enkla turn-based bokstavsspel.

## Vad Repon Innehaller

- Minimal C# backend (110 LOC) med in-memory spellager via ConcurrentDictionary
- Enstaka React-komponent i Frontend/, byggd till Server/wwwroot/
- 4 enkla endpoints: skapa spel, anslut, hämta tillstånd, spela bokstav
- Enhetstest (xUnit) och basisk API-testning

## Teknikstack

- Backend: .NET 8 Minimal API, in-memory ConcurrentDictionary (ingen databas)
- Frontend: React 18, Vite, sessionStorage för spelarpersistering
- Testing: xUnit (enhetstest), Newman API-test

## Krav

- .NET 8 SDK
- Node.js 18+

## Projektstruktur

```text
.
├── Server/
│   ├── Program.cs (110 LOC, kompletta spelreglerna här)
│   └── wwwroot/ (byggd frontend)
├── Frontend/
│   ├── src/
│   │   └── App.jsx (enskild komponent)
│   └── vite.config.js
└── Testing/
    └── UnitTests/ och SystemTests/
```

## Köra Appen

### Produktion (integrera frontend & backend)

```bash
cd Frontend
npm install
npm run build

cd ..
dotnet run --project Server/EverySecondLetter.csproj
```

Öppna http://127.0.0.1:5010

### Utveckling (med hot reload)

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

Öppna http://127.0.0.1:5173 (Vite proxar /games till backend)

## API (4 Endpoints)

- `POST /games?playerName=Alice` — Skapa nytt spel, returnerar gameId & playerId
- `POST /games/{gameId}/join?playerName=Bob` — Anslut till befintligt spel
- `GET /games/{gameId}` — Hämta aktuellt spelläge (ord, spelare, tur)
- `POST /games/{gameId}/letter?playerId=...&letter=E` — Spela nästkommande bokstav i sitt ord

## Frontend

App.jsx är den enda React-komponenten (~300 LOC):
- Läser/skriver spelardata från sessionStorage
- Skapa spel, anslut, visa spelläge, spela bokstav
- Polling var 2 sekund för speluppdateringar
- 10+ data-testid-attribut för automatiserad testning

## Testning

```bash
# Enhetstester (xUnit)
dotnet test Testing/UnitTests/EverySecondLetter.UnitTests/

# API-tester (Newman)
cd Testing/SystemTests
npm install
npm run test:api

# UI-tester (Playwright BDD)
npm run test:ui
```

- **Enhetstester:** TurnRulesTests (turordning), MinimalContractsTests (datamodeller)  
- **API-tester:** Grundläggande flöde create → join → state → play
- **UI-tester:** En Gherkin-scenario för complete gameplay flow

## Felsokning

- 404 vid uppdatering av djup länka:
  - Kontrollera att frontend-build finns i Server/wwwroot och att SPA-fallback (`MapFallbackToFile("index.html")`) är aktiverad i Program.cs.
- UI-tester kan inte ansluta:
  - Kontrollera att backend kör på http://127.0.0.1:5010.
- Frontend ombyggnad behövs:
  ```bash
  cd Frontend
  rm -rf dist node_modules package-lock.json
  npm install
  npm run build
  ```

## Relaterad Dokumentation

- TECH-DEBT.md


