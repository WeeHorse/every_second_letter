# EverySecondLetter (Minimal API + SQL)

## Requirements

* .NET 8 SDK
* PostgreSQL
* `psql` (optional)


## Setup Database

1. Create a database (e.g. `every_second_letter`)
2. Apply the SQL in sql/001_init.sql in your editor, or run in your command line if you have psql installed:

```bash
psql "<YOUR CONNECTION STRING>" -f sql/001_init.sql
```


## Configure Connection String

Default is set in `launchSettings.json`.

To override, set environment variable `DATABASE_URL`. Documentation: https://configu.com/blog/setting-env-variables-in-windows-linux-macos-beginners-guide/


## Run

```bash
dotnet run
```

Open the URL shown in the console
(default: [http://localhost:5010](http://localhost:5010))


## Notes

* Dictionary is small and in-memory (`WordsService` using `wordlists/enable1.txt`)
* Raw SQL in `GamesService` (no EF / repositories)
* Minimal API routes in `Program.cs`

---

# Gameplay & Rules

## Overview

EverySecondLetter is a two-player, turn-based word game.

Players collaboratively build a word by placing one letter at a time.
At any point (after placing a letter), a player may **claim** the current word to score points — but the opponent may **dispute** the claim.

The game introduces a risk-reward mechanic through the Claim / Dispute system.



## Game Flow

### Create / Join

* Player 1 creates a game.
* Player 2 joins using the Game ID.
* The game starts automatically when two players are present.



### Playing Letters

* Players take turns.
* On your turn, you may:

    * Place **exactly one letter (A–Z)**.
* The letter is appended to the current word.
* The turn then passes to the other player.

Example:

| Turn | Player | Word |
| ---- | ------ | ---- |
| 1    | A      | H    |
| 2    | B      | HE   |
| 3    | A      | HEL  |
| 4    | B      | HELL |



### Claiming a Word

A player may click **Claim Word**:

* On their turn
  **or**
* Immediately after placing their most recent letter

Minimum word length: **3 letters**

When a word is claimed:

* The game enters `PendingDispute` state
* No further letters can be placed
* The opponent must choose to:

    * **Accept**
    * **Dispute**



## Claim / Dispute Rules

### If the opponent Accepts

The claimer receives:

```
baseScore = (number of letters the claimer placed in this word)²
```

Example:

* Word = HELLO
* Player A placed H, L, O → 3 letters
* Score = 3² = 9 points



### If the opponent Disputes

The word is validated against the dictionary.

#### Case 1 — Word is valid

* Claimer receives **150%** of base score
* Opponent receives 0

```
finalScore = floor(baseScore × 1.5)
```

This rewards confident claims.



#### Case 2 — Word is invalid

* Claimer receives 0
* Opponent receives **50%** of base score

```
opponentScore = floor(baseScore × 0.5)
```

This punishes risky or fake claims.



## After Resolution

After Accept or Dispute:

* The current word resets to empty
* Letter contributions reset
* The turn goes to the opponent of the claimer
* The game continues



## Dictionary

* Words are validated using the ENABLE word list
* Word validation is case-insensitive
* Only words with **3 or more letters** are allowed



## Strategy

The game balances cooperation and competition:

* Build a strong word together…
* Or sabotage subtly.
* Claim early for safety…
* Or risk a dispute for bonus points.

---

# Test Strategy

This project uses three layers:

1. **Unit tests** – rule logic and scoring
2. **API tests** – HTTP contract and state transitions
3. **E2E (BDD)** – full browser gameplay validation

Goal: fast rule confidence → stable API → verified user behavior.



## 1) Unit Tests

### Scope

Test pure game rules without:

* HTTP
* Database
* Browser

Extract rule logic into a small testable core (e.g. `GameRules`).

### Must cover

**Turn rules**

* Wrong player cannot act
* Claim requires ≥3 letters
* Claim allowed immediately after placing last letter

**Scoring**

* Base = (letters placed)²
* Accept → 100%
* Dispute valid → floor(150%)
* Dispute invalid → opponent gets floor(50%)

**State transitions**

* InProgress → PendingDispute → InProgress
* Word + contributions reset after resolution



## 2) API Tests

### Scope

Validate:

* Routes
* Status codes
* DTO shape
* `X-Player-Token` auth
* State transitions

Use:

* `WebApplicationFactory<Program>`
* Dedicated test Postgres DB
* Apply schema on startup

### Core scenarios

* Create → Join → Get game
* Play letter (success + wrong turn)
* Claim → Accept
* Claim → Dispute (valid/invalid)
* 401 for missing/invalid token
* 409 for invalid game actions



## 3) E2E - BDD End-to-End Tests (Browser)

Validate real user flow with two browser sessions.

### Must cover

* Create + Join
* Turn-taking
* Claim after last letter
* Claim accepted
* Dispute valid
* Dispute invalid

Use fixed backend port and clean DB per run.


### Scope

E2E tests validate the real user flow:

* Two players
* Two browser sessions
* UI behavior (buttons enabled/disabled)
* Polling updates
* Claim/Dispute behavior in a real round

These tests should run against:

* The real backend (started before tests)
* The real static frontend (`wwwroot`)

### Recommended tooling

* **Playwright** (Node) for browser automation
* **Cucumber** (Gherkin) for BDD, or Playwright Test + a small Gherkin layer

### Why BDD here?

Because the rules are naturally expressed as behavior:

```gherkin
Given a game with two players
When player A places “H” and player B places “E”
And player A claims
Then the opponent can dispute
And scoring follows the rules
```


## Test Structure

```
/tests
  /UnitTests
  /ApiTests
  /E2E
```

---

## Definition of Done

* Unit tests cover scoring + state machine
* API tests cover all endpoints + failure paths
* E2E (BDD) covers one complete round

  create → join → play letters → claim → accept/dispute → verify score

