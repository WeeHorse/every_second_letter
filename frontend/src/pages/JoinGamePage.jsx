import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import './pages.css';

export default function JoinGamePage() {
  const { player, joinGame, error, loading } = useGame();
  const [gameId, setGameId] = useState('');
  const [joined, setJoined] = useState(false);

  const handleJoinGame = async (e) => {
    e.preventDefault();
    if (!gameId.trim()) {
      return;
    }

    const result = await joinGame(gameId);
    if (result) {
      setJoined(true);
    }
  };

  if (joined) {
    return (
      <div>
        <h2>Game Joined!</h2>
        <div className="success">
          <p>You've successfully joined the game.</p>
        </div>

        <div className="info-box">
          <p>Playing as: <strong>{player?.playerName}</strong></p>
        </div>

        <p style={{ fontSize: '14px', color: '#999', marginTop: '16px', textAlign: 'center' }}>
          The game will start once both players are present. Refresh to enter the game.
        </p>

        <button
          onClick={() => window.location.reload()}
          style={{ width: '100%', marginTop: '20px' }}
        >
          Enter Game
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2>Join Game</h2>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleJoinGame}>
        <div className="form-group">
          <label htmlFor="gameId">Game ID</label>
          <input
            id="gameId"
            type="text"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            placeholder="Paste the Game ID from your opponent"
            autoFocus
          />
        </div>

        <button type="submit" disabled={loading || !gameId.trim()} style={{ width: '100%' }}>
          {loading ? 'Joining...' : 'Join Game'}
        </button>
      </form>

      <div className="info-box" style={{ marginTop: '20px' }}>
        <p>Playing as: <strong>{player?.playerName}</strong></p>
      </div>
    </div>
  );
}
