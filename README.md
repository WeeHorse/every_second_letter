# EverySecondLetter

Turordningsbaserat ordspel for tva spelare, byggt med .NET 8 Minimal API, PostgreSQL eller SQLite och ett React + Vite-frontend.

## Vad Repon Innehaller

- Backend-API i C# (.NET 8) med SQL-lagring.
- React-frontend i Frontend/, byggs till Server/wwwroot/ for produktion.
- Spelregler for bokstavsspel, claim/dispute-poang och automatiskt slutspel.
- Systemtester med Postman/Newman (API) och Playwright + playwright-bdd (UI).

## Teknikstack

- Backend: .NET 8 Minimal API, providerbaserad SQL-atkomst (PostgreSQL/SQLite)
- Frontend: React 18, Vite, React Context
- Test: Postman/Newman (API), Playwright + playwright-bdd (UI)

## Krav

- .NET 8 SDK
- Node.js 18+
- PostgreSQL eller SQLite
- psql (valfritt men praktiskt)

## Projektstruktur

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

## Installation

### 1) Databas

Skapa en PostgreSQL-databas (till exempel every_second_letter).

Applikationen initierar och uppdaterar nodvandiga tabeller automatiskt vid uppstart.

### 2) Anslutningsstrang

Applikationen laser anslutningsstrang fran:

1. ConnectionStrings:Default
2. DATABASE_URL (fallback)

launchSettings.json innehaller lokala standardvarden, men DATABASE_URL kan skriva over.

### 3) Byt Databasprovider (Postgres eller SQLite)

Du kan byta provider via miljovariabler eller config.

Prioritetsordning:

1. ConnectionStrings:Default
2. DATABASE_URL
3. DB_PROVIDER + SQLITE_PATH (SQLite-lage)

Om inget anges blir standard/fallback SQLite.

Rekommenderad anvandning:

- Lokal utveckling: miljovariabler
- Delad/stabil setup: configfil (ConnectionStrings:Default)
- CI/deploy: miljovariabler

Anvand SQLite via env:

```bash
export DB_PROVIDER=sqlite
export SQLITE_PATH=every_second_letter.db
dotnet run --project Server/EverySecondLetter.csproj
```

Anvand Postgres via env:

```bash
export DB_PROVIDER=postgres
export DATABASE_URL=postgres://user:pass@host:5432/db
dotnet run --project Server/EverySecondLetter.csproj
```

Anvand configfil:

- Satt ConnectionStrings:Default till antingen:
  - Postgres-anslutningsstrang, eller
  - SQLite-anslutningsstrang, till exempel: Data Source=every_second_letter.db

## Korlage

### Utveckling (rekommenderas)

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

Oppna http://localhost:5173. Vite proxar /games till http://localhost:5010.

### Lokal produktionstest

```bash
cd Frontend
npm install
npm run build
cd ..
dotnet run --project Server/EverySecondLetter.csproj
```

Oppna http://localhost:5010.

## Frontend Sammanfattning

- Frontend ar byggt med React + Vite och byggs till Server/wwwroot/.
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

Se den kanoniska regelbeskrivningen i [Frontend/public/gameplay-and-rules.md](Frontend/public/gameplay-and-rules.md).

## API Oversikt

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

X-Player-Token krav:

- Kravs for: /games/{id}/start, /games/{id}/letter, /games/{id}/claim, /games/{id}/accept, /games/{id}/dispute
- Valfritt for: /games/{id}/join (anvands for rejoin-beteende)

Noteringar:

- Nuvarande EverySecondLetter startar fortfarande automatiskt nar tillrackligt manga spelare har anslutit.
- Start-endpointen finns for framtida spelvarianter med manuell start ovanpa samma konkreta word-game-karnan.

## Testning

Testerna finns i Testing/SystemTests och ar uppdelade i:

- api
- ui

Enhetstester finns i Testing/UnitTests/EverySecondLetter.UnitTests och kor med xUnit.

Kommandon:

```bash
cd Testing/SystemTests
npm install
npm run test
npm run test:api
npm run test:ui
npm run test:headed
dotnet test ../UnitTests/EverySecondLetter.UnitTests/EverySecondLetter.UnitTests.csproj
```

Noteringar:

- API-tester kor via Newman med Postman-kollektionen i Testing/SystemTests/postman/.
- Endast UI-tester genererar BDD-specar med bddgen.
- UI-testerna anvander baseURL http://localhost:5010.

## Felsokning

- 404 vid uppdatering av djup lanka:
  - Kontrollera att frontend-build finns i Server/wwwroot och att SPA-fallback ar aktiv.
- UI-tester kan inte ansluta:
  - Kontrollera att backend kor pa http://localhost:5010.
- Rejoin aterstaller inte spel:
  - Rensa sessionStorage/localStorage-nycklarna esl_player och esl_game, registrera sedan igen.
- Problem med frontend-beroenden:

```bash
cd Frontend
rm -rf node_modules package-lock.json
npm install
```

## Relaterad Dokumentation

- TECH-DEBT.md


