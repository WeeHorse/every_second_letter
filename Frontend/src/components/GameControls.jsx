import React from 'react';
import { useGame } from '../context/GameContext';
import './GameControls.css';

export default function GameControls({
  gameState,
  isMyTurn,
  isPendingDispute,
  isFinished,
  letter,
  setLetter,
  loading,
  setLoading,
}) {
  const { player, playLetter, claimWord, acceptClaim, disputeClaim } = useGame();

  const canClaim =
    gameState.currentWord?.length >= 3 &&
    gameState.lastLetterPlayerId === player?.token;

  // Determine which player slot the current user is
  const myPlayerIndex = gameState.players?.findIndex(p => p.playerId === player?.token);
  const myPlayer = myPlayerIndex >= 0 ? gameState.players[myPlayerIndex] : null;
  const myAccepts = myPlayer?.acceptsRemaining ?? 0;
  const myDisputes = myPlayer?.disputesRemaining ?? 0;

  const handlePlayLetter = async () => {
    if (!letter.trim()) return;
    setLoading(true);
    await playLetter(letter);
    setLetter('');
    setLoading(false);
  };

  const handleAccept = async () => {
    setLoading(true);
    await acceptClaim();
    setLoading(false);
  };

  const handleDispute = async () => {
    setLoading(true);
    await disputeClaim();
    setLoading(false);
  };

  const handleClaimWord = async () => {
    setLoading(true);
    await claimWord();
    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading && isMyTurn && !isPendingDispute) {
      handlePlayLetter();
    }
  };

  if (isFinished) {
    return (
      <div className="game-controls" data-testid="game-controls-finished" style={{ gridColumn: '1 / -1' }}>
        <div className="game-over">
          <h2>Game Over!</h2>
          {gameState.players?.length > 0 && (() => {
            const winner = gameState.players.reduce((best, p) => (p.score > best.score ? p : best), gameState.players[0]);
            const iWon = winner.playerId === player?.token;
            return <p style={{ marginTop: '8px' }}>{iWon ? '🏆 You won!' : 'Better luck next time!'}</p>;
          })()}
        </div>
      </div>
    );
  }

  return (
    <div className="game-controls" data-testid="game-controls" style={{ gridColumn: '1 / -1' }}>
      {isPendingDispute ? (
        <div data-testid="pending-claim-panel">
          <h3>Pending Claim</h3>
          <p data-testid="pending-word" style={{ marginBottom: '12px' }}>
            Word: <strong>{gameState.pendingWord}</strong>
          </p>

          {gameState.pendingClaimerId === player?.token ? (
            <p style={{ color: '#999' }}>Waiting for opponent to respond…</p>
          ) : (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button data-testid="accept-btn" onClick={handleAccept} disabled={loading || myAccepts <= 0} style={{ flex: 1 }}>
                Accept ✓ ({myAccepts} left)
              </button>
              <button data-testid="dispute-btn" onClick={handleDispute} disabled={loading || myDisputes <= 0} style={{ flex: 1 }}>
                Dispute ✗ ({myDisputes} left)
              </button>
            </div>
          )}
        </div>
      ) : (
        <div data-testid="turn-panel">
          {isMyTurn ? (
            <>
              <h3 className="turn-indicator">Your Turn</h3>
              <div className="letter-input-group">
                <input
                  data-testid="letter-input"
                  type="text"
                  value={letter}
                  onChange={(e) => setLetter(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter a letter"
                  maxLength="1"
                  autoFocus
                />
                <button data-testid="play-btn" onClick={handlePlayLetter} disabled={loading || !letter.trim()}>
                  Play
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="turn-indicator" data-testid="their-turn-indicator">Their turn
              </h3>
              <div className="letter-input-group">
                <input
                  data-testid="letter-input"
                  type="text"
                  value={letter}
                  placeholder="Waiting..."
                  maxLength="1"
                  disabled="disabled"
                />
                <button data-testid="play-btn" disabled="disabled">
                  Play
                </button>
              </div>
            </>
          )}

          {canClaim && (
            <button
              data-testid="claim-btn"
              onClick={handleClaimWord}
              disabled={loading}
              style={{ width: '100%', marginTop: '10px' }}
            >
              Claim Word
            </button>
          )}
        </div>
      )}
    </div>
  );
}

