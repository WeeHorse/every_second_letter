import React, { createContext, useContext, useState, useEffect } from 'react';

const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const [player, setPlayer] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load player from tab-scoped storage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('esl_player') ?? localStorage.getItem('esl_player');
    if (saved) {
      try {
        const parsedPlayer = JSON.parse(saved);
        setPlayer(parsedPlayer);
        // One-time migration for users who previously used localStorage.
        sessionStorage.setItem('esl_player', JSON.stringify(parsedPlayer));
      } catch (e) {
        console.error('Failed to load saved player', e);
      }
    }

    const savedGame = sessionStorage.getItem('esl_game') ?? localStorage.getItem('esl_game');
    if (savedGame) {
      try {
        const game = JSON.parse(savedGame);
        setGameId(game.gameId);
        // One-time migration for users who previously used localStorage.
        sessionStorage.setItem('esl_game', JSON.stringify({ gameId: game.gameId }));
      } catch (e) {
        console.error('Failed to load saved game', e);
      }
    }
  }, []);

  // Save player to tab-scoped storage whenever it changes
  useEffect(() => {
    if (player) {
      sessionStorage.setItem('esl_player', JSON.stringify(player));
    }
  }, [player]);

  // Save game to tab-scoped storage whenever it changes
  useEffect(() => {
    if (gameId) {
      sessionStorage.setItem('esl_game', JSON.stringify({ gameId }));
    }
  }, [gameId]);

  const registerPlayer = (playerName) => {
    const playerId = crypto.randomUUID();
    const newPlayer = { playerId, playerName };
    setPlayer(newPlayer);
    setError(null);
    return newPlayer;
  };

  const createGame = async () => {
    if (!player) {
      setError('Player not registered');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerName: player.playerName }),
      });
      if (!res.ok) throw new Error('Failed to create game');

      const data = await res.json();
      setGameId(data.gameId);
      
      // Store player token
      const updatedPlayer = {
        ...player,
        token: data.playerToken,
      };
      setPlayer(updatedPlayer);

      return data;
    } catch (e) {
      const msg = e.message || 'Error creating game';
      setError(msg);
      console.error(msg, e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async (joinGameId) => {
    if (!player) {
      setError('Player not registered');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = {};
      if (player.token) {
        headers['X-Player-Token'] = player.token;
      }

      const res = await fetch(`/games/${joinGameId}/join`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerName: player.playerName }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to join game');
      }

      const data = await res.json();
      setGameId(data.gameId);

      const updatedPlayer = {
        ...player,
        token: data.playerToken,
      };
      setPlayer(updatedPlayer);

      return data;
    } catch (e) {
      const msg = e.message || 'Error joining game';
      setError(msg);
      console.error(msg, e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getGameState = async () => {
    if (!gameId || !player?.token) return null;

    try {
      const res = await fetch(`/games/${gameId}`, {
        headers: { 'X-Player-Token': player.token },
      });

      if (!res.ok) throw new Error('Failed to fetch game state');

      const data = await res.json();
      setGameState(data);
      return data;
    } catch (e) {
      console.error('Error fetching game state', e);
      return null;
    }
  };

  const playLetter = async (letter) => {
    if (!gameId || !player?.token) return null;

    try {
      const res = await fetch(`/games/${gameId}/letter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Player-Token': player.token,
        },
        body: JSON.stringify({ letter }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to play letter');
      }

      const data = await res.json();
      setGameState(data);
      return data;
    } catch (e) {
      setError(e.message);
      console.error('Error playing letter', e);
      return null;
    }
  };

  const claimWord = async () => {
    if (!gameId || !player?.token) return null;

    try {
      const res = await fetch(`/games/${gameId}/claim`, {
        method: 'POST',
        headers: { 'X-Player-Token': player.token },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to claim word');
      }

      const data = await res.json();
      setGameState(data);
      return data;
    } catch (e) {
      setError(e.message);
      console.error('Error claiming word', e);
      return null;
    }
  };

  const acceptClaim = async () => {
    if (!gameId || !player?.token) return null;

    try {
      const res = await fetch(`/games/${gameId}/accept`, {
        method: 'POST',
        headers: { 'X-Player-Token': player.token },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to accept claim');
      }

      const data = await res.json();
      setGameState(data);
      return data;
    } catch (e) {
      setError(e.message);
      console.error('Error accepting claim', e);
      return null;
    }
  };

  const disputeClaim = async () => {
    if (!gameId || !player?.token) return null;

    try {
      const res = await fetch(`/games/${gameId}/dispute`, {
        method: 'POST',
        headers: { 'X-Player-Token': player.token },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to dispute claim');
      }

      const data = await res.json();
      setGameState(data);
      return data;
    } catch (e) {
      setError(e.message);
      console.error('Error disputing claim', e);
      return null;
    }
  };

  const logout = () => {
    setPlayer(null);
    setGameId(null);
    setGameState(null);
    sessionStorage.removeItem('esl_player');
    sessionStorage.removeItem('esl_game');
    // Also clear legacy keys in case they still exist from older versions.
    localStorage.removeItem('esl_player');
    localStorage.removeItem('esl_game');
  };

  const value = {
    player,
    gameId,
    gameState,
    error,
    loading,
    setError,
    registerPlayer,
    createGame,
    joinGame,
    getGameState,
    playLetter,
    claimWord,
    acceptClaim,
    disputeClaim,
    logout,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};
