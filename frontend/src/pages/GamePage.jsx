import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { useGame } from '../context/GameContext';
import WordDisplay from '../components/WordDisplay';
import ScoreBoard from '../components/ScoreBoard';
import GameControls from '../components/GameControls';
import './GamePage.css';

export default function GamePage() {
  const { player, gameId, gameState, getGameState, error, setError, logout } = useGame();
  const [letter, setLetter] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [rulesHtml, setRulesHtml] = useState('');
  const [rulesError, setRulesError] = useState('');
  const getStateRef = useRef(getGameState);

  // Keep ref in sync without triggering effect re-runs
  useEffect(() => {
    getStateRef.current = getGameState;
  });

  // Poll for game state once mounted; clean up on unmount
  useEffect(() => {
    getStateRef.current();
    const interval = setInterval(() => getStateRef.current(), 1000);
    return () => clearInterval(interval);
  }, []); // runs once

  useEffect(() => {
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

  useEffect(() => {
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

  const isWaiting = gameState?.status === 'WaitingForPlayers';
  const isMyTurn = gameState?.activePlayerId === player?.token;
  const isPendingDispute = gameState?.status === 'PendingDispute';
  const isFinished = gameState?.status === 'Finished';
  const areYouPlayer1 = gameState?.player1Id === player?.token;
  const areYouPlayer2 = gameState?.player2Id === player?.token;
  const player1DisplayName = gameState?.players?.[0]?.playerName?.trim() || 'Player 1';
  const player2DisplayName = gameState?.players?.[1]?.playerName?.trim() || 'Player 2';

  const renderHeader = () => (
    <div className="game-header">
      <h1>EverySecondLetter</h1>
      <div className="game-header-actions">
        <button onClick={() => setIsRulesOpen(true)} className="rules-btn">Rules</button>
        <button onClick={logout} className="logout-btn">Quit</button>
      </div>
    </div>
  );

  const renderRulesPanel = () => (
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
  );

  // --- Loading state (first fetch not yet complete) ---
  if (!gameState) {
    return (
      <main data-testid="game-loading-page">
        <div className="card" data-testid="game-loading-card">
          {renderHeader()}
          <p style={{ textAlign: 'center', color: '#666', marginTop: '24px' }}>Loading game...</p>
        </div>
        {renderRulesPanel()}
      </main>
    );
  }

  // --- Waiting for second player ---
  if (isWaiting) {
    return (
      <main data-testid="game-waiting-page">
        <div className="card" data-testid="game-waiting-card">
          {renderHeader()}

          <div className="success" style={{ marginTop: '20px' }}>
            Game created! Share the Game ID with your opponent.
          </div>

          <div className="info-box" style={{ marginTop: '16px' }}>
            <p><strong>Game ID</strong></p>
            <p data-testid="game-id-text" style={{ fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '8px', fontSize: '14px' }}>
              {gameId}
            </p>
            <button
              data-testid="copy-game-id-btn"
              onClick={() => navigator.clipboard.writeText(gameId)}
              style={{ marginTop: '10px', width: '100%' }}
            >
              Copy Game ID
            </button>
          </div>

          <p style={{ textAlign: 'center', color: '#999', marginTop: '20px', fontSize: '14px' }}>
            Waiting for opponent to join…
          </p>
        </div>
        {renderRulesPanel()}
      </main>
    );
  }

  // --- Active / finished game ---
  return (
    <main data-testid="game-active-page">
      <div className="card" data-testid="game-active-card">
        {renderHeader()}

        {error && <div className="error">{error}</div>}

        <div className="game-grid">
          <div>
            <h3>
              Status: <span data-testid="game-status">{gameState.status}</span>
            </h3>
            {isFinished && <div className="success" style={{ marginTop: '8px' }}>Game Over!</div>}
            {isMyTurn && !isPendingDispute && !isFinished && (
              <div className="info-box" style={{ marginTop: '8px' }}>It's your turn!</div>
            )}
            {!isMyTurn && !isPendingDispute && !isFinished && (
              <div className="info-box" style={{ marginTop: '8px' }}>Waiting for opponent…</div>
            )}
          </div>

          <WordDisplay word={gameState.currentWord} />

          <ScoreBoard
            player1Name={areYouPlayer1 ? `You (${player.playerName})` : `They (${player1DisplayName})`}
            player1Score={gameState.player1Score}
            player1Accepts={gameState.player1Accepts}
            player1Disputes={gameState.player1Disputes}
            player2Name={areYouPlayer2 ? `You (${player.playerName})` : `They (${player2DisplayName})`}
            player2Score={gameState.player2Score}
            player2Accepts={gameState.player2Accepts}
            player2Disputes={gameState.player2Disputes}
          />

          <GameControls
            gameState={gameState}
            isMyTurn={isMyTurn}
            isPendingDispute={isPendingDispute}
            isFinished={isFinished}
            letter={letter}
            setLetter={setLetter}
            loading={loading}
            setLoading={setLoading}
          />
        </div>
      </div>
      {renderRulesPanel()}
    </main>
  );
}

