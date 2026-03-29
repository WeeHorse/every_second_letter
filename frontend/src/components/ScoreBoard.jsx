import React from 'react';
import './ScoreBoard.css';

export default function ScoreBoard({
  player1Name,
  player1Score,
  player1Accepts,
  player1Disputes,
  player2Name,
  player2Score,
  player2Accepts,
  player2Disputes,
}) {
  return (
    <div className="scoreboard">
      <div className="score-item">
        <div className="player-name">{player1Name}</div>
        <div className="score">{player1Score}</div>
        <div className="actions">
          <span title="Accepts remaining">✓ {player1Accepts}</span>
          <span title="Disputes remaining">✗ {player1Disputes}</span>
        </div>
      </div>

      <div className="score-item">
        <div className="player-name">{player2Name}</div>
        <div className="score">{player2Score}</div>
        <div className="actions">
          <span title="Accepts remaining">✓ {player2Accepts}</span>
          <span title="Disputes remaining">✗ {player2Disputes}</span>
        </div>
      </div>
    </div>
  );
}
