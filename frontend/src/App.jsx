import React from 'react';
import './App.css';

const sessionKey = 'minimal-demo-session';

function readSession() {
  const raw = sessionStorage.getItem(sessionKey);
  if (!raw) {
    return {
      playerName: 'Alice',
      gameId: '',
      playerId: '',
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      playerName: 'Alice',
      gameId: '',
      playerId: '',
    };
  }
}

export default function App() {
  const [session, setSession] = React.useState(readSession);
  const [joinGameId, setJoinGameId] = React.useState('');
  const [gameState, setGameState] = React.useState(null);
  const [letter, setLetter] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    sessionStorage.setItem(sessionKey, JSON.stringify(session));
  }, [session]);

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(typeof data === 'string' ? data : text || 'Request failed');
    }

    return data;
  }

  async function loadGameState(gameId = session.gameId) {
    if (!gameId) {
      return;
    }

    try {
      const state = await fetchJson(`/games/${gameId}`);
      setGameState(state);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  React.useEffect(() => {
    if (!session.gameId) {
      setGameState(null);
      return undefined;
    }

    loadGameState(session.gameId);
    const timer = window.setInterval(() => {
      loadGameState(session.gameId);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [session.gameId]);

  async function createGame() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const params = new URLSearchParams({ playerName: session.playerName || 'Player' });
      const data = await fetchJson(`/games?${params.toString()}`, { method: 'POST' });
      setSession((current) => ({
        ...current,
        gameId: data.gameId,
        playerId: data.playerId,
      }));
      setMessage('Game created. Share the game ID with the second player.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function joinGame(event) {
    event.preventDefault();
    if (!joinGameId.trim()) {
      setError('Enter a game ID to join.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const params = new URLSearchParams({ playerName: session.playerName || 'Player' });
      const data = await fetchJson(`/games/${joinGameId.trim()}/join?${params.toString()}`, {
        method: 'POST',
      });
      setSession((current) => ({
        ...current,
        gameId: data.gameId,
        playerId: data.playerId,
      }));
      setMessage('Joined the game.');
      setJoinGameId('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function playLetter(event) {
    event.preventDefault();
    if (!letter.trim()) {
      setError('Enter one letter.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await fetchJson(`/games/${session.gameId}/letter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Player-Token': session.playerId,
        },
        body: JSON.stringify({ letter: letter.trim().slice(0, 1) }),
      });
      setGameState((current) => current ? {
        ...current,
        currentWord: data.currentWord,
        activePlayerId: data.activePlayer,
      } : current);
      setLetter('');
      setMessage('Letter played.');
      await loadGameState();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function resetSession() {
    const nextSession = {
      playerName: session.playerName || 'Alice',
      gameId: '',
      playerId: '',
    };
    setSession(nextSession);
    setJoinGameId('');
    setGameState(null);
    setLetter('');
    setMessage('Session cleared.');
    setError('');
  }

  const activePlayer = gameState?.players?.find((player) => player.playerId === gameState.activePlayerId);
  const isPlayersTurn = Boolean(session.playerId && gameState?.activePlayerId === session.playerId);

  return (
    <main className="shell">
      <section className="panel hero">
        <p className="eyebrow">Minimal Demo</p>
        <h1 data-testid="app-title">EverySecondLetter</h1>
        <p className="lede">Create a game, share the game ID, and take turns adding one letter at a time.</p>
      </section>

      <section className="panel stack">
        <label className="field">
          <span>Player name</span>
          <input
            data-testid="player-name-input"
            value={session.playerName}
            onChange={(event) => setSession((current) => ({ ...current, playerName: event.target.value }))}
            placeholder="Alice"
          />
        </label>

        <div className="actions">
          <button data-testid="create-game-btn" onClick={createGame} disabled={loading || !session.playerName.trim()}>
            Create game
          </button>
          <button className="secondary" onClick={resetSession} disabled={loading}>
            Reset
          </button>
        </div>

        <form className="join-row" onSubmit={joinGame}>
          <input
            data-testid="join-game-id-input"
            value={joinGameId}
            onChange={(event) => setJoinGameId(event.target.value)}
            placeholder="Paste a game ID to join"
          />
          <button data-testid="join-game-btn" type="submit" disabled={loading || !session.playerName.trim()}>
            Join game
          </button>
        </form>

        {message ? <p className="notice success">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
      </section>

      <section className="panel stack">
        <div className="status-row">
          <div>
            <p className="label">Your player ID</p>
            <p data-testid="player-id-value" className="mono">{session.playerId || 'Not assigned yet'}</p>
          </div>
          <div>
            <p className="label">Current game</p>
            <p data-testid="game-id-value" className="mono">{session.gameId || 'No active game'}</p>
          </div>
        </div>

        <div className="status-row">
          <div>
            <p className="label">Status</p>
            <p data-testid="game-status">{gameState?.status || 'Idle'}</p>
          </div>
          <div>
            <p className="label">Current word</p>
            <p data-testid="current-word" className="word">{gameState?.currentWord || '—'}</p>
          </div>
          <div>
            <p className="label">Active player</p>
            <p>{activePlayer?.playerName || 'Waiting for players'}</p>
          </div>
        </div>

        <form className="play-row" onSubmit={playLetter}>
          <input
            data-testid="letter-input"
            value={letter}
            onChange={(event) => setLetter(event.target.value.toUpperCase())}
            placeholder="One letter"
            maxLength={1}
          />
          <button data-testid="play-letter-btn" type="submit" disabled={loading || !session.gameId || !session.playerId || !isPlayersTurn}>
            Play letter
          </button>
          <button data-testid="refresh-btn" type="button" className="secondary" onClick={() => loadGameState()} disabled={loading || !session.gameId}>
            Refresh
          </button>
        </form>

        <p data-testid="turn-note" className="turn-note">{isPlayersTurn ? 'Your turn.' : 'Waiting for the active player.'}</p>

        <div className="players">
          {(gameState?.players || []).map((player) => (
            <article key={player.playerId} className={player.playerId === gameState.activePlayerId ? 'player-card active' : 'player-card'}>
              <p className="player-name">{player.playerName}</p>
              <p className="mono small">{player.playerId}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
