import React from 'react';
import './ScoreBoard.css';

export default function ScoreBoard({ players }) {
  return (
    <div className="scoreboard" data-testid="scoreboard">
      {players.map((player, index) => {
        const slot = index + 1;
        return (
          <div className="score-item" data-testid={`score-player-${slot}`} key={player.playerId}>
            <div className="player-name">{player.displayName}</div>
            <div className="score" data-testid={`score-player-${slot}-value`}>{player.score}</div>
            <div className="actions">
              <span data-testid={`score-player-${slot}-accepts`} title="Accepts remaining">✓ {player.acceptsRemaining}</span>
              <span data-testid={`score-player-${slot}-disputes`} title="Disputes remaining">✗ {player.disputesRemaining}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
