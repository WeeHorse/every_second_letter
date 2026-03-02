# EverySecondLetter (Clean + Minimal API + SQL)

## Requirements
- .NET 8 SDK
- Postgres
- psql (optional)

## Setup DB
1) Create a database (example: everysecondletter)
2) Run:
   psql "<YOUR CONNECTION STRING>" -f sql/001_init.sql

## Configure connection string
Either:
- set environment variable DATABASE_URL (postgres://user:pass@host:5432/dbname)
or
- set ConnectionStrings__Default

### Examples:

Mac/Linux (for a session, read documentation below for guide):
`export DATABASE_URL=postgres://postgres:postgres@localhost:5432/every_second_letter`

Windows (for a session):
`set DATABASE_URL=postgres://postgres:postgres@localhost:5432/every_second_letter`

or permanently,
`setx DATABASE_URL "postgres://postgres:postgres@localhost:5432/every_second_letter"`

Documentation: https://configu.com/blog/setting-env-variables-in-windows-linux-macos-beginners-guide/


## Run
dotnet run

Then open:
http://localhost:5000 (or the URL shown by dotnet)

## Notes
- Dictionary is tiny and in-memory (WordsService). Dispute uses it.
- No EF, no repositories; SQL lives in GamesService.
- Minimal API routes are defined in Program.cs (top-level statements).
