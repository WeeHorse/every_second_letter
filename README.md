# EverySecondLetter

Turordningsbaserat ordspel för två spelare, byggt med .NET 8 Minimal API, PostgreSQL och ett React + Vite-frontend.

## Vad Repon Innehaller

- Backend-API i C# (.NET 8) med SQL-lagring.
- React-frontend i frontend/, byggs till wwwroot/ for produktion.
- Spelregler for bokstavsspel, claim/dispute-poang och automatiskt slutspel.
- Systemtester (API + UI BDD) med Playwright + playwright-bdd.

## Teknikstack

- Backend: .NET 8 Minimal API, Npgsql, PostgreSQL
- Frontend: React 18, Vite, React Context
- Test: Playwright, playwright-bdd

## Krav

- .NET 8 SDK
- Node.js 18+
- PostgreSQL
- psql (valfritt men praktiskt)

## Projektstruktur

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

## Installation

### 1) Databas

Skapa en PostgreSQL-databas (till exempel every_second_letter) och kor:

```bash
psql "<YOUR CONNECTION STRING>" -f sql/001_init.sql
```

### 2) Anslutningsstrang

Applikationen laser anslutningsstrang fran:

1. ConnectionStrings:Default
2. DATABASE_URL (fallback)

launchSettings.json innehaller lokala standardvarden, men DATABASE_URL kan skriva over.

## Korlage

### Utveckling (rekommenderas)

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

Oppna http://localhost:5173. Vite proxar /games till http://localhost:5010.

### Lokal produktionstest

```bash
cd frontend
npm install
npm run build
cd ..
dotnet run
```

Oppna http://localhost:5010.

## Frontend Sammanfattning

- Frontend ar byggt med React + Vite och byggs till wwwroot/.
- SPA-fallback i Program.cs skriver om icke-API och icke-filrutter till /index.html.
- Huvudsidor:
  - RegisterPage
  - CreateGamePage
  - JoinGamePage
  - GamePage
- Centrala komponenter:
  - WordDisplay
  - ScoreBoard
  - GameControls
- Tillstand hanteras i GameContext via useGame().
- Persistens ar sessionStorage-forst, med localStorage-fallback for migrering av aldre data.
- Polling av spelstatus sker for narvarande var 1000 ms i GamePage.

## Spelregler

Se den kanoniska regelbeskrivningen i [frontend/public/gameplay-and-rules.md](frontend/public/gameplay-and-rules.md).

## API Oversikt

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

X-Player-Token krav:

- Kravs for: /games/{id}/letter, /games/{id}/claim, /games/{id}/accept, /games/{id}/dispute
- Valfritt for: /games/{id}/join (anvands for rejoin-beteende)

## Testning

Testerna finns i Testing/SystemTests och ar uppdelade i:

- api
- ui

Kommandon:

```bash
cd Testing/SystemTests
npm install
npm run test
npm run test:api
npm run test:ui
npm run test:headed
```

Noteringar:

- test och projektspecifika korningar genererar om BDD-specar med bddgen.
- UI-testerna anvander baseURL http://localhost:5010.

## Felsokning

- 404 vid uppdatering av djup lanka:
  - Kontrollera att frontend-build finns i wwwroot och att SPA-fallback ar aktiv.
- UI-tester kan inte ansluta:
  - Kontrollera att backend kor pa http://localhost:5010.
- Rejoin aterstaller inte spel:
  - Rensa sessionStorage/localStorage-nycklarna esl_player och esl_game, registrera sedan igen.
- Problem med frontend-beroenden:

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Relaterad Dokumentation

- TECH-DEBT.md


