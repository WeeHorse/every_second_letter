import React from 'react';
import { marked } from 'marked';
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
  const [isRulesOpen, setIsRulesOpen] = React.useState(false);
  const [rulesHtml, setRulesHtml] = React.useState('');
  const [rulesError, setRulesError] = React.useState('');

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

  return (
    <main>
      <div className="card">
        <div className="create-join-header">
          <h1>EverySecondLetter</h1>
          <button className="rules-entry-btn" onClick={() => setIsRulesOpen(true)}>
            Rules
          </button>
        </div>
        {!showJoin ? (
          <>
            <CreateGamePage />
            <button
              data-testid="toggle-join"
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
              data-testid="toggle-create"
              onClick={() => setShowJoin(false)}
              style={{ marginTop: '20px', width: '100%' }}
            >
              Create a new game instead
            </button>
          </>
        )}
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
            <h2>Rules</h2>
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

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
