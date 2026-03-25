Här är en komplett svensk översättning, med samma struktur och exakt tre huvudrubriker (`#`):

````md
# EverySecondLetter (Minimal API + SQL)

## Krav

* .NET 8 SDK
* PostgreSQL
* `psql` (valfritt)


## Sätt upp databasen

1. Skapa en databas (t.ex. `every_second_letter`)
2. Kör SQL-skriptet i `sql/001_init.sql` i din editor, eller via kommandoraden om du har `psql` installerat:

```bash
psql "<YOUR CONNECTION STRING>" -f sql/001_init.sql
````

## Konfigurera anslutningssträng

Default finns i `launchSettings.json`.

För att skriva över det, sätt en miljövariabel `DATABASE_URL`. 

Dokumentation för miljövariabler: https://configu.com/blog/setting-env-variables-in-windows-linux-macos-beginners-guide/


## Starta applikationen

```bash
dotnet run
```

Öppna den URL som visas i konsolen
(standard: [http://localhost:5010](http://localhost:5010))

## Noteringar

* Ordlistan är liten och laddas i minnet (`WordsService` använder `wordlists/enable1.txt`)
* Rå SQL används i `GamesService` (ingen EF / repositories)
* Minimal API-routes definieras i `Program.cs`

---

# Spelregler

## Översikt

EverySecondLetter är ett turordningsbaserat ordspel för två spelare.

Spelarna bygger tillsammans upp ett ord genom att lägga en bokstav i taget.
När som helst (efter att ha lagt en bokstav) kan en spelare **claima** det aktuella ordet för att få poäng — men motspelaren kan **bestrida** (dispute) det.

Spelet bygger på en risk/belönings-mekanik genom Claim / Dispute-systemet.

## Spelflöde

### Skapa / Gå med

* Spelare 1 skapar ett spel.
* Spelare 2 går med via Game ID.
* Spelet startar automatiskt när två spelare är anslutna.

### Lägga bokstäver

* Spelarna turas om.

* På din tur får du:

  * Lägga **exakt en bokstav (A–Z)**.

* Bokstaven läggs till i slutet av det aktuella ordet.

* Turen går sedan vidare till motspelaren.

Exempel:

| Tur | Spelare | Ord  |
| --- | ------- | ---- |
| 1   | A       | H    |
| 2   | B       | HE   |
| 3   | A       | HEL  |
| 4   | B       | HELL |

### Claima ett ord

En spelare kan klicka på **Claim Word**:

* På sin tur
  **eller**
* Direkt efter att ha lagt sin senaste bokstav

Minsta ordlängd: **3 bokstäver**

När ett ord claimas:

* Spelet går in i tillståndet `PendingDispute`
* Inga fler bokstäver kan läggas
* Motspelaren måste välja:

  * **Accept**
  * **Dispute**

## Claim / Dispute-regler

### Om motspelaren accepterar

Den som claimade får:

```
baseScore = (antal bokstäver som claimaren lagt i detta ord)²
```

Exempel:

* Ord = HELLO
* Spelare A lade H, L, O → 3 bokstäver
* Poäng = 3² = 9 poäng

### Åtgärdsbegränsningar och slutspel

Varje spelare börjar med **5 acceptera** och **5 bestrida**-poäng. När spelaren
frågas om accept eller dispute tas ett av dessa poäng i anspråk och räknaren
uppdateras i knapparna i gränssnittet.

Spelet slutar helt automatiskt när **båda spelarna** har använt alla tio åtgärder.
Den spelare som då har högst poäng vinner; oavgjort är möjligt. Gränssnittet
visar tydligt status och vinnare i slutet.

### Om motspelaren bestrider (Dispute)

Ordet kontrolleras mot ordlistan.

#### Fall 1 — Ordet är giltigt

* Claimaren får **150 %** av grundpoängen
* Motspelaren får 0

```
finalScore = floor(baseScore × 1.5)
```

Detta belönar självsäkra claims.

#### Fall 2 — Ordet är ogiltigt

* Claimaren får 0
* Motspelaren får **50 %** av grundpoängen

```
opponentScore = floor(baseScore × 0.5)
```

Detta straffar riskabla eller felaktiga claims.

## Efter avgörande

Efter Accept eller Dispute:

* Det aktuella ordet nollställs
* Bokstavsbidrag nollställs
* Turen går till motspelaren till den som claimade
* Spelet fortsätter

## Ordlista

* Ord valideras mot ENABLE-ordlistan
* Validering är skiftlägesokänslig
* Endast ord med **3 eller fler bokstäver** är tillåtna

## Strategi

Spelet balanserar samarbete och konkurrens:

* Bygg ett starkt ord tillsammans …
* Eller sabotera subtilt.
* Claima tidigt för säker poäng …
* Eller ta risken och få bonus vid dispute.

---

# Teststrategi

Projektet använder tre testlager:

1. **Enhetstester** – regellogik och poängberäkning
2. **API-tester** – HTTP-kontrakt och tillståndsövergångar
3. **E2E (BDD)** – full validering av spel via webbläsare

Mål: snabb tillit till regler → stabilt API → verifierat användarbeteende.

## 1) Enhetstester

### Omfattning

Testa ren spel­logik utan:

* HTTP
* Databas
* Webbläsare

Extrahera regellogiken till en liten testbar kärna (t.ex. `GameRules`).

### Måste täcka

**Turregler**

* Fel spelare får inte agera
* Claim kräver minst 3 bokstäver
* Claim är tillåtet direkt efter senast lagd bokstav

**Poängberäkning**

* Baspoäng = (antal lagda bokstäver)²
* Accept → 100 %
* Dispute giltigt → floor(150 %)
* Dispute ogiltigt → motspelaren får floor(50 %)

**Tillståndsövergångar**

* InProgress → PendingDispute → InProgress
* Ord + bokstavsbidrag nollställs efter avgörande

## 2) API-tester

### Omfattning

Validera:

* Routes
* Statuskoder
* DTO-struktur
* `X-Player-Token`-autentisering
* Tillståndsövergångar

Använd:

* `WebApplicationFactory<Program>`
* En separat Postgres-testdatabas
* Applicera schema vid teststart

### Centrala scenarier

* Create → Join → Get game
* Play letter (lyckat + fel tur)
* Claim → Accept
* Claim → Dispute (giltigt/ogiltigt)
* 401 vid saknad/fel token
* 409 vid ogiltig spelåtgärd

## 3) E2E – BDD End-to-End (webbläsare)

Validera verkligt användarflöde med två webbläsarsessioner.

### Måste täcka

* Create + Join
* Turordning
* Claim direkt efter sista bokstaven
* Claim accepterad
* Dispute giltigt ord
* Dispute ogiltigt ord

Använd fast backend-port och ren testdatabas per körning.

### Omfattning

E2E-tester verifierar:

* Två spelare
* Två webbläsarsessioner
* UI-beteende (aktiva/inaktiva knappar)
* Polling-uppdateringar
* Claim/Dispute i en komplett runda

Testerna ska köras mot:

* Riktig backend (startas före tester)
* Riktig frontend (`wwwroot`)

### Rekommenderade verktyg

* **Playwright** (Node) för webbläsarautomation
* **Cucumber** (Gherkin) för BDD, eller Playwright Test med ett enklare Gherkin-lager

### Varför BDD?

Reglerna uttrycks naturligt som beteende:

```gherkin
Given a game with two players
When player A places "H" and player B places "E"
And player A claims
Then the opponent can dispute
And scoring follows the rules
```

## Teststruktur

```
/tests
  /UnitTests
  /ApiTests
  /E2E
```

---

## Definition of Done

* Enhetstester täcker poäng + tillståndsmaskin
* API-tester täcker alla endpoints + felvägar
* E2E (BDD) täcker minst en komplett spelrunda

  create → join → play letters → claim → accept/dispute → verifiera poäng


