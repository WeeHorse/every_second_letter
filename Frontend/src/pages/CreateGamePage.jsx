import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import './pages.css';

export default function CreateGamePage() {
  const { player, createGame, error, loading } = useGame();
  const [gameCreated, setGameCreated] = useState(null);

  const handleCreateGame = async () => {
    const result = await createGame();
    if (result) {
      setGameCreated(result);
    }
  };

  if (gameCreated) {
    return (
      <div>
        <h2>Game Created!</h2>
        <div className="success">
          <p>Your game has been created. Share the Game ID with your opponent:</p>
        </div>

        <div className="info-box">
          <p>
            <strong>Game ID:</strong>
            <br />
            <span className="code">{gameCreated.gameId}</span>
          </p>
          <button
            onClick={() => navigator.clipboard.writeText(gameCreated.gameId)}
            style={{ marginTop: '10px', width: '100%' }}
          >
            Copy Game ID
          </button>
        </div>

        <div className="info-box" style={{ marginTop: '20px' }}>
          <p>
            <strong>Your Player Token:</strong>
            <br />
            <span className="code" style={{ fontSize: '12px' }}>{gameCreated.playerToken}</span>
          </p>
          <p style={{ fontSize: '12px', marginTop: '8px', color: '#999' }}>
            This token identifies you in the game. It will be saved automatically.
          </p>
        </div>

        <div className="info-box" style={{ marginTop: '20px' }}>
          <p>Waiting for your opponent to join...</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '10px', width: '100%' }}>
            Refresh to see if they've joined
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="create-page">
      <h2>Create New Game</h2>

      {error && <div className="error">{error}</div>}

      <div className="info-box">
        <p>Playing as: <strong>{player?.playerName}</strong></p>
      </div>

      <button
        data-testid="create-game-btn"
        onClick={handleCreateGame}
        disabled={loading}
        style={{ width: '100%', marginTop: '20px' }}
      >
        {loading ? 'Creating...' : 'Create Game'}
      </button>

      <p style={{ fontSize: '14px', color: '#999', marginTop: '16px', textAlign: 'center' }}>
        You'll be Player 1. Share the generated Game ID with Player 2 to join.
      </p>
    </div>
  );
}
