# React Frontend Setup

This React frontend is configured to build with Vite and outputs to the `wwwroot` directory, where the .NET backend serves it as static content.

## Architecture

- **Build Tool**: Vite (fast, minimal configuration)
- **Framework**: React 18
- **State Management**: React Context (useGame hook)
- **Styling**: CSS modules with scoped styles
- **Deployment**: Built into `wwwroot/`, served by .NET backend
- **Development**: Local dev server with /games API proxy

## Development Setup

### 1. Install dependencies
```bash
cd frontend
npm install
```

### 2. Start dev server
```bash
npm run dev
```

This starts Vite on `http://localhost:5173` with automatic proxying of `/games` requests to `http://localhost:5010` (the .NET backend).

### 3. In another terminal, start the .NET backend
```bash
dotnet run
```

The backend will start on `http://localhost:5010`.

## Production Build

```bash
cd frontend
npm run build
```

This builds React using Vite and outputs optimized files to `../wwwroot/`. The .NET backend will automatically serve these files.

To start the production server:
```bash
dotnet run
```

Then navigate to `http://localhost:5010` in your browser.

## Project Structure

```
frontend/
  src/
    main.jsx           # Entry point
    App.jsx            # Root component with routing logic
    index.css          # Global styles
    
    context/
      GameContext.jsx  # Global state management (provider + hook)
    
    pages/
      RegisterPage.jsx   # Player registration
      CreateGamePage.jsx # Create new game
      JoinGamePage.jsx   # Join existing game
      GamePage.jsx       # Active gameplay
    
    components/
      WordDisplay.jsx    # Shows current word being formed
      ScoreBoard.jsx     # Displays player scores & action counts
      GameControls.jsx   # Letter input & game actions
  
  index.html        # HTML entry point
  vite.config.js    # Vite configuration
  package.json      # Dependencies & scripts
```

## State Management (GameContext)

The `useGame()` hook provides:

```javascript
const {
  player,           // { playerId, playerName, token }
  gameId,           // Current game UUID
  gameState,        // Full game state object
  error,            // Error message (if any)
  loading,          // Loading indicator
  
  registerPlayer,   // (playerName) => void
  createGame,       // () => Promise<{gameId, playerToken}>
  joinGame,         // (gameId) => Promise<{gameId, playerToken}>
  getGameState,     // () => Promise<gameState>
  playLetter,       // (letter) => Promise<gameState>
  claimWord,        // () => Promise<gameState>
   acceptClaim,     // () => Promise<gameState>
  disputeClaim,     // () => Promise<gameState>
  logout,           // () => void
} = useGame();
```

### LocalStorage Persistence

Player data and game ID are automatically persisted to localStorage:
- `esl_player`: `{ playerId, playerName, token }`
- `esl_game`: `{ gameId }`

## API Integration

All API calls are made through GameContext methods, which handle:
- Automatic player token injection via `X-Player-Token` header
- Error handling and propagation
- State updates

Available endpoints (all relative to `/`):
- `POST /games` - Create new game
- `POST /games/{id}/join` - Join game
- `GET /games/{id}` - Get current game state
- `POST /games/{id}/letter` - Play a letter
- `POST /games/{id}/claim` - Claim word
- `POST /games/{id}/accept` - Accept claim
- `POST /games/{id}/dispute` - Dispute claim

## Environment Variables

For development, the Vite dev server proxies `/games` requests to `http://localhost:5010`.

In production, the .NET backend serves React files and handles all API requests directly.

## Troubleshooting

**"Page not found" on refresh**: Ensure the .NET SPA fallback middleware is enabled in Program.cs. The middleware rewrites non-API, non-file paths to `/index.html`.

**CORS errors**: The Vite dev server handles this with the proxy config in `vite.config.js`. In production, both frontend and API are served from the same origin.

**Player token missing**: Clear localStorage and re-register:
```javascript
localStorage.removeItem('esl_player');
localStorage.removeItem('esl_game');
```

## Build & Deploy Workflow

1. Edit React code in `frontend/src/`
2. Run `npm run build` in `frontend/`
3. Commit the `wwwroot/` changes
4. Deploy the .NET application (includes built React frontend)

The .NET server automatically serves the built React app at the root route.
