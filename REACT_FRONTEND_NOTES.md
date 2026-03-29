# EverySecondLetter - React Frontend Build Instructions

## Quick Start

### 1. Development
```bash
# Terminal 1: Build and serve React frontend
cd frontend
npm install
npm run dev

# Terminal 2: Start .NET backend
dotnet run
```

Visit `http://localhost:5173` - the Vite dev server will proxy API calls to the .NET backend on `http://localhost:5010`.

### 2. Production Build
```bash
# Build React to wwwroot/
cd frontend
npm install
npm run build

# Start .NET server
dotnet run
```

Visit `http://localhost:5010` - the .NET backend serves the React build as static files.

## Architecture

**Frontend Stack:**
- React 18 + Vite
- React Context for state (useGame hook)
- Client-side routing (page components in `/src/pages/`)
- CSS modules for styling

**Backend Stack:**
- .NET 8 Minimal API
- PostgreSQL
- CORS handled via dev server proxy (Vite dev) or same-origin (production)

**Building & Deployment:**
1. Build React: `cd frontend && npm install && npm run build`
2. This outputs to `wwwroot/` (where .NET serves it)
3. Deploy the entire project (includes built React frontend)
4. Backend serves `wwwroot/` as static content
5. React handles all client-side routing

## Frontend Pages

1. **Register** - Player name entry (stored in localStorage)
2. **Create/Join** - Toggle between creating a new game or joining an existing one
3. **Game** - Active gameplay with letter input, word tiles, score tracking

## Key Features

- ✅ Player persistence (localStorage-based)
- ✅ Game state polling (500ms intervals)
- ✅ Real-time score updates
- ✅ Turn-based letter play
- ✅ Word claiming & dispute workflow
- ✅ Responsive design

## Troubleshooting

**npm install fails:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**API calls getting 404 in dev:**
Ensure .NET backend is running on `http://localhost:5010`. The Vite dev server proxies `/games` requests there.

**Stale build in wwwroot:**
```bash
cd frontend
rm -rf node_modules ../wwwroot
npm install
npm run build
```

See `frontend/README.md` for detailed development documentation.
