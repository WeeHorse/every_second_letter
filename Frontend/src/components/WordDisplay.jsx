import React from 'react';
import './WordDisplay.css';

export default function WordDisplay({ word }) {
  const letters = word?.split('') || [];

  return (
    <div className="word-display" data-testid="word-display">
      <h3>Current Word</h3>
      <div className="word-tiles" data-testid="word-tiles">
        {letters.length === 0 ? (
          <div className="word-tile empty" data-testid="word-empty"></div>
        ) : (
          letters.map((letter, idx) => (
            <div key={idx} className="word-tile" data-testid="word-tile">
              {letter}
            </div>
          ))
        )}
      </div>
      <p data-testid="word-count" style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
        {letters.length} letter{letters.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
