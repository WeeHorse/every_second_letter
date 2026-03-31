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
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      throw new Error(typeof data === 'string' ? data : data?.message || text || 'Request failed');
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
      setGameState(null);
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
      await loadGameState(data.gameId);
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
      await loadGameState(data.gameId);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitGameAction(path, body, successMessage) {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const headers = {
        'X-Player-Token': session.playerId,
      };

      if (body) {
        headers['Content-Type'] = 'application/json';
      }

      const data = await fetchJson(path, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      setGameState(data);
      setMessage(data?.lastResolutionSummary || successMessage);
      return data;
    } catch (requestError) {
      setError(requestError.message);
      return null;
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

    const data = await submitGameAction(
      `/games/${session.gameId}/letter`,
      { letter: letter.trim().slice(0, 1) },
      'Letter played.',
    );

    if (data) {
      setLetter('');
    }
  }

  async function claimWord() {
    await submitGameAction(`/games/${session.gameId}/claim`, null, 'Word claimed.');
  }

  async function acceptClaim() {
    await submitGameAction(`/games/${session.gameId}/accept`, null, 'Claim accepted.');
  }

  async function disputeClaim() {
    await submitGameAction(`/games/${session.gameId}/dispute`, null, 'Claim disputed.');
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

  const players = gameState?.players || [];
  const activePlayer = players.find((player) => player.playerId === gameState?.activePlayerId);
  const currentPlayer = players.find((player) => player.playerId === session.playerId);
  const pendingClaim = gameState?.pendingClaim;
  const claimer = players.find((player) => player.playerId === pendingClaim?.claimerId);
  const responder = players.find((player) => player.playerId === pendingClaim?.responderId);
  const isPlayersTurn = Boolean(session.playerId && gameState?.activePlayerId === session.playerId);
  const canClaim = Boolean(
    session.playerId
    && gameState?.status === 'InProgress'
    && (gameState?.currentWord?.length || 0) >= 3
    && (gameState?.activePlayerId === session.playerId || gameState?.lastLetterPlayerId === session.playerId),
  );
  const canAccept = Boolean(
    session.playerId
    && gameState?.status === 'PendingDispute'
    && pendingClaim?.responderId === session.playerId
    && (currentPlayer?.acceptsRemaining || 0) > 0,
  );
  const canDispute = Boolean(
    session.playerId
    && gameState?.status === 'PendingDispute'
    && pendingClaim?.responderId === session.playerId
    && (currentPlayer?.disputesRemaining || 0) > 0,
  );
  const winner = players.find((player) => player.playerId === gameState?.winnerPlayerId);
  const statusNote = (() => {
    if (!gameState) {
      return 'Create or join a game to begin.';
    }

    if (gameState.status === 'WaitingForPlayers') {
      return 'Waiting for a second player.';
    }

    if (gameState.status === 'PendingDispute') {
      if (pendingClaim?.responderId === session.playerId) {
        return 'Respond to the pending claim.';
      }

      return 'Waiting for the opponent to accept or dispute.';
    }

    if (gameState.status === 'Finished') {
      return gameState.winnerSummary || 'Game finished.';
    }

    return isPlayersTurn ? 'Your turn.' : 'Waiting for the active player.';
  })();

  return (
    <main className="shell">
      <section className="panel hero">
        <p className="eyebrow">Full Rules Demo</p>
        <h1 data-testid="app-title">EverySecondLetter</h1>
        <p className="lede">Build a word together, then claim it for points and force the opponent to accept or dispute before play continues.</p>
        <p>
          <a className="rules-link" href="/gameplay-and-rules.md" target="_blank" rel="noreferrer" data-testid="rules-link">
            Read full gameplay and rules
          </a>
        </p>
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

        {pendingClaim ? (
          <div className="notice success">
            <p><strong>Pending claim:</strong> {claimer?.playerName || 'A player'} claimed {pendingClaim.word}.</p>
            <p>{responder?.playerName || 'The opponent'} must accept or dispute.</p>
            <p>Base score: {pendingClaim.baseScore} ({pendingClaim.lettersPlacedByClaimer} letters placed by the claimer).</p>
          </div>
        ) : null}

        {gameState?.lastResolutionSummary ? (
          <div className="notice success">
            <p>{gameState.lastResolutionSummary}</p>
          </div>
        ) : null}

        {gameState?.status === 'Finished' ? (
          <div className="notice success">
            <p><strong>Winner:</strong> {winner?.playerName || 'Draw'}</p>
            <p>{gameState.winnerSummary}</p>
          </div>
        ) : null}

        <form className="play-row" onSubmit={playLetter}>
          <input
            data-testid="letter-input"
            value={letter}
            onChange={(event) => setLetter(event.target.value.toUpperCase())}
            placeholder="One letter"
            maxLength={1}
          />
          <button data-testid="play-letter-btn" type="submit" disabled={loading || !session.gameId || !session.playerId || !isPlayersTurn || gameState?.status !== 'InProgress'}>
            Play letter
          </button>
          <button type="button" onClick={claimWord} disabled={loading || !session.gameId || !session.playerId || !canClaim}>
            Claim word
          </button>
          <button type="button" className="secondary" onClick={acceptClaim} disabled={loading || !canAccept}>
            Accept ({currentPlayer?.acceptsRemaining ?? 0})
          </button>
          <button type="button" className="secondary" onClick={disputeClaim} disabled={loading || !canDispute}>
            Dispute ({currentPlayer?.disputesRemaining ?? 0})
          </button>
          <button data-testid="refresh-btn" type="button" className="secondary" onClick={() => loadGameState()} disabled={loading || !session.gameId}>
            Refresh
          </button>
        </form>

        <p data-testid="turn-note" className="turn-note">{statusNote}</p>

        <div className="players">
          {players.map((player) => (
            <article key={player.playerId} className={player.playerId === gameState.activePlayerId ? 'player-card active' : 'player-card'}>
              <p className="player-name">{player.playerName}</p>
              <p>Score: {player.score}</p>
              <p>Accepts left: {player.acceptsRemaining}</p>
              <p>Disputes left: {player.disputesRemaining}</p>
              <p className="mono small">{player.playerId}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
