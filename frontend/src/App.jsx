import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import RegisterPage from './pages/RegisterPage';
import CreateGamePage from './pages/CreateGamePage';
import JoinGamePage from './pages/JoinGamePage';
import GamePage from './pages/GamePage';
import './App.css';


function AppContent() {
  const { player, gameId } = useGame();

  // Route logic: player exists + gameId exists → go to GamePage (handles its own loading/waiting states)
  if (!player) {
    return <RegisterPage />;
  }

  if (!gameId) {
    return <CreateOrJoinPage />;
  }

  return <GamePage />;
}

function CreateOrJoinPage() {
  const [showJoin, setShowJoin] = React.useState(false);

  return (
    <main>
      <div className="card">
        <h1>EverySecondLetter</h1>
        {!showJoin ? (
          <>
            <CreateGamePage />
            <button
              onClick={() => setShowJoin(true)}
              style={{ marginTop: '20px', width: '100%' }}
            >
              Already have a Game ID? Join instead
            </button>
          </>
        ) : (
          <>
            <JoinGamePage />
            <button
              onClick={() => setShowJoin(false)}
              style={{ marginTop: '20px', width: '100%' }}
            >
              Create a new game instead
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
