import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import WordDisplay from '../components/WordDisplay';
import ScoreBoard from '../components/ScoreBoard';
import GameControls from '../components/GameControls';
import './GamePage.css';

export default function GamePage() {
  const { player, gameId, gameState, getGameState, error, setError, logout } = useGame();
  const [letter, setLetter] = useState('');
  const [loading, setLoading] = useState(false);
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

  const isWaiting = gameState?.status === 'WaitingForPlayers';
  const isMyTurn = gameState?.activePlayerId === player?.token;
  const isPendingDispute = gameState?.status === 'PendingDispute';
  const isFinished = gameState?.status === 'Finished';
  const areYouPlayer1 = gameState?.player1Id === player?.token;
  const areYouPlayer2 = gameState?.player2Id === player?.token;

  // --- Loading state (first fetch not yet complete) ---
  if (!gameState) {
    return (
      <main>
        <div className="card">
          <div className="game-header">
            <h1>EverySecondLetter</h1>
            <button onClick={logout} className="logout-btn">Leave</button>
          </div>
          <p style={{ textAlign: 'center', color: '#666', marginTop: '24px' }}>Loading game...</p>
        </div>
      </main>
    );
  }

  // --- Waiting for second player ---
  if (isWaiting) {
    return (
      <main>
        <div className="card">
          <div className="game-header">
            <h1>EverySecondLetter</h1>
            <button onClick={logout} className="logout-btn">Leave</button>
          </div>

          <div className="success" style={{ marginTop: '20px' }}>
            Game created! Share the Game ID with your opponent.
          </div>

          <div className="info-box" style={{ marginTop: '16px' }}>
            <p><strong>Game ID</strong></p>
            <p style={{ fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '8px', fontSize: '14px' }}>
              {gameId}
            </p>
            <button
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
      </main>
    );
  }

  // --- Active / finished game ---
  return (
    <main>
      <div className="card">
        <div className="game-header">
          <h1>EverySecondLetter</h1>
          <button onClick={logout} className="logout-btn">Leave</button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="game-grid">
          <div>
            <h3>Status: {gameState.status}</h3>
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
            player1Name={areYouPlayer1 ? `You (${player.playerName})` : 'Opponent'}
            player1Score={gameState.player1Score}
            player1Accepts={gameState.player1Accepts}
            player1Disputes={gameState.player1Disputes}
            player2Name={areYouPlayer2 ? `You (${player.playerName})` : 'Opponent'}
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
    </main>
  );
}

