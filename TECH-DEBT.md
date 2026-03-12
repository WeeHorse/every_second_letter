# Technical Debt Report

## Backend (C#) Tech Debt

### Critical Issues

**Raw SQL with manual mapping**
- The codebase uses raw SQL queries with manual `NpgsqlDataReader` mapping. This is fragile and error-prone—magic indices like `r.GetGuid(0)`, `r.GetGuid(4)` make refactoring risky.
- Consider adopting **Entity Framework Core** or **Dapper** with mapped queries.

**Enum parsing without safety**
- `Enum.Parse<GameStatus>(r.GetString(1))` throws if the value doesn't exist.
- Should use `Enum.TryParse()` with fallback handling.

**Repeated transaction boilerplate**
- Every method follows the same try-catch-rollback pattern.
- Extract this into a reusable helper method to reduce DRY violations:
```csharp
private async Task<T> RunInTransaction<T>(Func<NpgsqlConnection, NpgsqlTransaction, Task<T>> operation)
```

### Moderate Issues

- **Magic numbers**: `MinLength = 3` is hardcoded. Move to configuration (`appsettings.json`).

- **Dead code**: `ClaimWordAsync` has a commented-out validation (`if (g.ActivePlayerId != playerToken)`). Delete it or document why it's disabled.

- **Insufficient input validation**: Letter normalization only checks length and character set. No validation that the word builds logically (e.g., doesn't break existing claim rules).

- **No rate limiting**: Anyone can spam requests to create/join games or submit letters.

- **Player token security**: Tokens are guessable GUIDs without authentication. No way to verify a player actually owns their token.

---

## Frontend (JavaScript) Tech Debt

### Critical Issues

**No TypeScript**
- JavaScript without type safety makes refactoring risky and prevents IDE assistance.

**Global mutable state**
- Single `state` object with no encapsulation. All functions mutate it directly—makes testing impossible and enables accidental state corruption.

**Plain text localStorage**
- Game credentials stored in `localStorage` without encryption. Any script can read them via DevTools.

**Magic polling interval**
- `setInterval(() => { ... }, 800)` hardcoded. Move to config constant.

**No error resilience**
- Network errors in `refresh()` are silently swallowed (`.catch(() => { })`). Users won't know polling failed.

**XSS vulnerability**
- `marked.parse()` renders markdown without sanitization. If rules.md comes from untrusted source, it's vulnerable.
- Use:
```javascript
const dirty = marked.parse(markdown);
const clean = DOMPurify.sanitize(dirty);
```

### Moderate Issues

- **DOM element caching as globals**: The `els` object assumes all elements exist on load. If an element is missing, subsequent code breaks silently.

- **Duplicate event listener patterns**: Copy buttons and other handlers repeat similar logic. Extract to helper functions.

- **Magic delays**: `setTimeout(() => els.joinBtn.click(), 100)` for auto-join is a race condition workaround. Should wait for DOM ready or use promise chains.

- **No event listener cleanup**: No remove handlers on page unload—potential memory leaks if the app is kept open long-term.

- **Hardcoded port assumptions**: `updateGameLink()` uses `window.location.origin`, which works but ties the app to its deployment URL.

---

## Database & Infrastructure Tech Debt

### Design Issues

- **No migrations framework**: SQL schema is a single init file. No version control for schema changes—risky for rollbacks.

- **Orphaned `contributions` records**: After claim resolution, contributions are deleted but there's no cleanup strategy if errors occur mid-transaction.

- **No audit logging**: No record of game outcomes, disputes, or state changes for debugging or analytics.

- **Missing security headers**:
  - No `CORS` policy configured
  - No `CSP` (Content Security Policy) header
  - No `X-Frame-Options`, `X-Content-Type-Options`

### Performance Issues

- **No connection pooling configuration**: Npgsql will pool by default, but explicit configuration is missing.

- **N+1 queries potential**: `GetStateAsync` runs left joins, but if this query is called frequently enough, consider caching or denormalization.

---

## API & Architecture Tech Debt

### Design

- **No API versioning**: If the API changes, clients break. Consider `/v1/games` routes.

- **Status as string enums**: `GameStatus.InProgress.ToString()` stored in DB—brittle. Should use int enums or migration on rename.

- **Implicit player two-player limitation**: Code assumes exactly 2 players. Scaling to more players would require significant refactoring.

- **Commented-out dev features**: `app.UseDeveloperExceptionPage()` is always on (commented condition). Should respect environment:
```csharp
if (app.Environment.IsDevelopment())
    app.UseDeveloperExceptionPage();
```

---

## Testing & Quality Assurance

- **No unit tests**: Zero unit tests for business logic (score calculation, word validation, turn mechanics).
- **E2E tests only**: Playwright tests exist but aren't running in CI/CD.
- **No logging**: No structured logging (serilog, etc.) for debugging production issues.

---

## Priority Recommendations

### High Priority (Security/Stability)

1. Add XSS protection: `DOMPurify` for markdown rendering
2. Move secrets/tokens out of localStorage
3. Implement rate limiting and proper authentication (JWT)
4. Add input validation on all API endpoints

### Medium Priority (Maintainability)

1. Migrate to Entity Framework Core or Dapper
2. Add unit tests for game logic
3. Convert to TypeScript
4. Extract state management into a proper class/store

### Low Priority (Polish)

1. Add API versioning
2. Implement structured logging
3. Extract configuration to `appsettings.json`
4. Add migration framework (FluentMigrator)
