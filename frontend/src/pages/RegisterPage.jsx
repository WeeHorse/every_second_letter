import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import './pages.css';

export default function RegisterPage() {
  const { registerPlayer } = useGame();
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');

  const handleRegister = (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Player name is required');
      return;
    }

    registerPlayer(playerName);
    setError('');
  };

  return (
    <main>
      <div className="card">
        <h1>EverySecondLetter</h1>
        <h2>Register Player</h2>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label htmlFor="playerName">Your Name</label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your player name"
              autoFocus
            />
          </div>

          <button type="submit" style={{ width: '100%' }}>
            Continue
          </button>
        </form>

        <div className="info-box">
          <p>
            A unique player ID will be created for you. You'll use this to join games and keep
            track of your progress across sessions.
          </p>
        </div>
      </div>
    </main>
  );
}
