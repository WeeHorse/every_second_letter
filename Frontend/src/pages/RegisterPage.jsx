import React, { useState } from 'react';
import { marked } from 'marked';
import { useGame } from '../context/GameContext';
import './pages.css';

export default function RegisterPage() {
  const { registerPlayer } = useGame();
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [rulesHtml, setRulesHtml] = useState('');
  const [rulesError, setRulesError] = useState('');

  React.useEffect(() => {
    if (!isRulesOpen || rulesHtml) {
      return;
    }

    let isMounted = true;

    async function loadRules() {
      try {
        const response = await fetch('/gameplay-and-rules.md');
        if (!response.ok) {
          throw new Error('Failed to load rules document');
        }

        const markdown = await response.text();
        const html = await marked.parse(markdown);

        if (isMounted) {
          setRulesError('');
          setRulesHtml(html);
        }
      } catch {
        if (isMounted) {
          setRulesError('Error loading rules.');
        }
      }
    }

    loadRules();

    return () => {
      isMounted = false;
    };
  }, [isRulesOpen, rulesHtml]);

  React.useEffect(() => {
    if (!isRulesOpen) {
      return;
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setIsRulesOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRulesOpen]);

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
    <main data-testid="register-page">
      <div className="card">
        <div className="register-header">
          <h1>EverySecondLetter</h1>
          <button className="rules-entry-btn" onClick={() => setIsRulesOpen(true)}>
            Rules
          </button>
        </div>
        <h2>Register Player</h2>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label htmlFor="playerName">Your Name</label>
            <input
              data-testid="player-name-input"
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your player name"
              autoFocus
            />
          </div>

          <button data-testid="register-continue" type="submit" style={{ width: '100%' }}>
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

      <div
        className={`rules-overlay ${isRulesOpen ? '' : 'hidden'}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setIsRulesOpen(false);
          }
        }}
        aria-hidden={!isRulesOpen}
      >
        <aside className={`rules-panel ${isRulesOpen ? '' : 'hidden'}`} role="dialog" aria-modal="true" aria-label="Gameplay and rules">
          <div className="rules-header">
            <h2>Gameplay & Rules</h2>
            <button onClick={() => setIsRulesOpen(false)} className="close-btn" aria-label="Close rules panel">×</button>
          </div>
          <div className="rules-content">
            {!rulesHtml && !rulesError && <p>Loading rules...</p>}
            {rulesError && <p>{rulesError}</p>}
            {rulesHtml && <div dangerouslySetInnerHTML={{ __html: rulesHtml }} />}
          </div>
        </aside>
      </div>
    </main>
  );
}
