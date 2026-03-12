const els = {
  createBtn: document.getElementById("createBtn"),
  joinBtn: document.getElementById("joinBtn"),
  joinGameId: document.getElementById("joinGameId"),
  gameIdOut: document.getElementById("gameIdOut"),
  playerTokenOut: document.getElementById("playerTokenOut"),
  setup: document.getElementById("setup"),
  game: document.getElementById("game"),

  statusOut: document.getElementById("statusOut"),
  activeMarquee: document.getElementById("activeMarquee"),
  wordOut: document.getElementById("wordOut"),
  pendingOut: document.getElementById("pendingOut"),
  p1Out: document.getElementById("p1Out"),
  p2Out: document.getElementById("p2Out"),
  p1ScoreOut: document.getElementById("p1ScoreOut"),
  p2ScoreOut: document.getElementById("p2ScoreOut"),

  letterIn: document.getElementById("letterIn"),
  playBtn: document.getElementById("playBtn"),
  claimBtn: document.getElementById("claimBtn"),
  gameIdGameOut: document.getElementById("gameIdGameOut"),
  copyGameIdBtn: document.getElementById("copyGameIdBtn"),
  gameLinkOut: document.getElementById("gameLinkOut"),
  copyGameLinkBtn: document.getElementById("copyGameLinkBtn"),
  disputeRow: document.getElementById("disputeRow"),
  acceptBtn: document.getElementById("acceptBtn"),
  disputeBtn: document.getElementById("disputeBtn"),
  leaveBtn: document.getElementById("leaveBtn"),

  rulesBtn: document.getElementById("rulesBtn"),
  rulesPanel: document.getElementById("rulesPanel"),
  closeRulesBtn: document.getElementById("closeRulesBtn"),
  rulesContent: document.getElementById("rulesContent"),

  wordHistory: document.getElementById("wordHistory"),
  log: document.getElementById("log"),
};

let state = {
  gameId: null,
  playerToken: null,
  game: null,
  pollTimer: null,
  previousGame: null,
  completedWords: [],
};

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  els.log.textContent = `[${ts}] ${msg}\n` + els.log.textContent;
}

function setCreds(gameId, playerToken) {
  state.gameId = gameId;
  state.playerToken = playerToken;
  state.previousGame = null;
  state.completedWords = [];

  els.gameIdOut.textContent = gameId ?? "-";
  els.playerTokenOut.textContent = playerToken ?? "-";

  // put join field for convenience
  els.joinGameId.value = gameId ?? "";

  if (gameId && playerToken) {
    updateGameLink();
    els.setup.classList.add("hidden");
    els.game.classList.remove("hidden");
    startPolling();
  }
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";
  if (state.playerToken) headers["X-Player-Token"] = state.playerToken;
  const res = await fetch(path, { ...options, headers });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if (!res.ok) {
    const msg = data?.error || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data;
}

function render(game) {
  if (!game) return;

  // Track completed words
  if (state.previousGame) {
    // Detect word completion: transition FROM PendingDispute TO InProgress
    // This means the dispute was just resolved, so points are now awarded
    if (state.previousGame.status === "PendingDispute" && game.status === "InProgress") {
      const completedWord = state.previousGame.pendingWord;
      if (completedWord) {
        // Figure out who scored by comparing scores
        const p1DeltaScore = game.player1Score - state.previousGame.player1Score;
        const p2DeltaScore = game.player2Score - state.previousGame.player2Score;

        let scoringPlayer = null;
        let pointsAwarded = 0;

        if (p1DeltaScore > 0) {
          scoringPlayer = "Player 1";
          pointsAwarded = p1DeltaScore;
        } else if (p2DeltaScore > 0) {
          scoringPlayer = "Player 2";
          pointsAwarded = p2DeltaScore;
        }

        // Only record if someone actually scored (not disputed)
        if (pointsAwarded > 0) {
          validateAndRecordWord(completedWord, scoringPlayer, pointsAwarded, state.gameId);
        } else {
          // Word was disputed and found invalid - still record but as disputed
          recordDisputedWord(completedWord);
        }
      }
    }
  }

  state.previousGame = JSON.parse(JSON.stringify(game));

  els.statusOut.textContent = game.status;

  // Display "Player 1" or "Player 2" in the marquee
  let activePlayerDisplay = "-";
  if (game.activePlayerId === game.player1Id) {
    activePlayerDisplay = "Player 1";
  } else if (game.activePlayerId === game.player2Id) {
    activePlayerDisplay = "Player 2";
  }
  els.activeMarquee.textContent = activePlayerDisplay;

  els.gameIdGameOut.textContent = state.gameId || "-";
  updateGameLink();

  // Render word as letter tiles
  els.wordOut.innerHTML = "";
  if (game.currentWord && game.currentWord.length > 0) {
    game.currentWord.split("").forEach(letter => {
      const tile = document.createElement("span");
      tile.className = "word-tile";
      tile.textContent = letter;
      els.wordOut.appendChild(tile);
    });
  } else {
    els.wordOut.innerHTML = '<span class="word-tile empty">(empty)</span>';
  }

  els.p1Out.textContent = game.player1Id;
  els.p2Out.textContent = game.player2Id ?? "(not joined)";
  els.p1ScoreOut.textContent = game.player1Score;
  els.p2ScoreOut.textContent = game.player2Score;

  const pending = game.status === "PendingDispute"
    ? `claimer=${game.pendingClaimerId} word="${game.pendingWord}"`
    : "(none)";
  els.pendingOut.textContent = pending;

  const canRespond = game.status === "PendingDispute" &&
    game.player2Id &&
    game.pendingClaimerId &&
    state.playerToken &&
    state.playerToken !== game.pendingClaimerId;

  els.disputeRow.classList.toggle("hidden", !canRespond);

  const myTurn = state.playerToken &&
    game.activePlayerId === state.playerToken &&
    game.status === "InProgress";

  const canClaimAfterLast =
    state.playerToken &&
    game.status === "InProgress" &&
    game.lastLetterPlayerId === state.playerToken;

  els.playBtn.disabled = !myTurn;
  els.letterIn.disabled = !myTurn;

  // Claim är tillåtet om:
  // 1) det är din tur
  // 2) eller du var den som la senaste bokstaven
  els.claimBtn.disabled = !(myTurn || canClaimAfterLast);
  els.playBtn.disabled = !myTurn;
  els.letterIn.disabled = !myTurn;

  if (myTurn) els.letterIn.focus();
}

async function validateAndRecordWord(word, player, points, gameId) {
  try {
    const result = await api(`/games/${gameId}/validate-word`, {
      method: "POST",
      body: JSON.stringify({ word })
    });

    console.log("Word validation result:", { word, valid: result.valid, result });

    state.completedWords.push({
      word: word,
      player: player,
      points: points,
      valid: result.valid,
    });
  } catch (err) {
    console.error("Word validation error:", err);
    // If validation fails, still record the word but mark validity as unknown
    state.completedWords.push({
      word: word,
      player: player,
      points: points,
      valid: null,
    });
  }

  renderWordHistory();
}

function recordDisputedWord(word) {
  state.completedWords.push({
    word: word,
    player: "Disputed",
    points: 0,
    valid: null,
  });
  renderWordHistory();
}

function renderWordHistory() {
  els.wordHistory.innerHTML = "";

  if (state.completedWords.length === 0) {
    els.wordHistory.innerHTML = '<div class="word-history-empty">No completed words yet</div>';
    return;
  }

  state.completedWords.forEach((entry, idx) => {
    const item = document.createElement("div");
    item.className = "word-history-item";

    const word = document.createElement("span");
    word.className = "word-history-word";
    word.textContent = entry.word.toUpperCase();

    const meta = document.createElement("span");
    meta.className = "word-history-meta";

    if (entry.points > 0) {
      meta.textContent = `${entry.player} +${entry.points}`;
    } else {
      meta.textContent = "Disputed";
    }

    const validity = document.createElement("span");
    validity.className = "word-history-validity";

    if (entry.valid === true) {
      validity.className += " valid";
      validity.textContent = "✓";
    } else if (entry.valid === false) {
      validity.className += " invalid";
      validity.textContent = "✗";
    } else {
      validity.className += " unknown";
      validity.textContent = "?";
    }

    item.appendChild(word);
    item.appendChild(meta);
    item.appendChild(validity);
    els.wordHistory.appendChild(item);
  });
}

async function refresh() {
  if (!state.gameId) return;
  const game = await api(`/games/${state.gameId}`, { method: "GET" });
  state.game = game;
  render(game);
}

function startPolling() {
  stopPolling();
  refresh().catch(e => log(`refresh error: ${e.message}`));
  state.pollTimer = setInterval(() => {
    refresh().catch(() => { });
  }, 800);
}

function stopPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = null;
}

function updateGameLink() {
  if (state.gameId) {
    const link = `${window.location.origin}/?join=${state.gameId}`;
    els.gameLinkOut.textContent = link;
  } else {
    els.gameLinkOut.textContent = "-";
  }
}

// --- Actions ---
els.createBtn.addEventListener("click", async () => {
  try {
    const res = await api("/games", { method: "POST" });
    setCreds(res.gameId, res.playerToken);
    log(`Created game ${res.gameId}`);
  } catch (e) { log(e.message); }
});

els.joinBtn.addEventListener("click", async () => {
  const gid = els.joinGameId.value.trim();
  if (!gid) return log("Enter a game id to join.");
  try {
    const res = await api(`/games/${gid}/join`, { method: "POST" });
    setCreds(res.gameId, res.playerToken);
    // Clear and update localStorage with the new player's credentials
    localStorage.setItem("esl_creds", JSON.stringify({ gameId: res.gameId, playerToken: res.playerToken }));
    log(`Joined game ${res.gameId}`);
  } catch (e) { log(e.message); }
});

els.playBtn.addEventListener("click", async () => {
  const letter = els.letterIn.value.trim();
  els.letterIn.value = "";
  try {
    const game = await api(`/games/${state.gameId}/letter`, {
      method: "POST",
      body: JSON.stringify({ letter })
    });
    state.game = game;
    render(game);
  } catch (e) { log(e.message); }
});

els.letterIn.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") els.playBtn.click();
});

els.claimBtn.addEventListener("click", async () => {
  try {
    const game = await api(`/games/${state.gameId}/claim`, { method: "POST" });
    state.game = game;
    render(game);
  } catch (e) { log(e.message); }
});

els.acceptBtn.addEventListener("click", async () => {
  try {
    const game = await api(`/games/${state.gameId}/accept`, { method: "POST" });
    state.game = game;
    render(game);
  } catch (e) { log(e.message); }
});

els.disputeBtn.addEventListener("click", async () => {
  try {
    const game = await api(`/games/${state.gameId}/dispute`, { method: "POST" });
    state.game = game;
    render(game);
  } catch (e) { log(e.message); }
});

els.copyGameIdBtn.addEventListener("click", () => {
  if (state.gameId) {
    navigator.clipboard.writeText(state.gameId).then(() => {
      log(`Copied game ID: ${state.gameId}`);
    }).catch(err => {
      log(`Failed to copy: ${err.message}`);
    });
  }
});

els.copyGameLinkBtn.addEventListener("click", () => {
  const linkText = els.gameLinkOut.textContent;
  if (linkText && linkText !== "-") {
    navigator.clipboard.writeText(linkText).then(() => {
      log(`Copied game link`);
    }).catch(err => {
      log(`Failed to copy: ${err.message}`);
    });
  }
});

els.leaveBtn.addEventListener("click", () => {
  console.log("Leave button clicked");
  stopPolling();
  state.gameId = null;
  state.game = null;
  state.previousGame = null;
  state.completedWords = [];
  els.gameIdOut.textContent = "-";
  els.gameLinkOut.textContent = "-";
  els.wordHistory.innerHTML = "";
  els.game.classList.add("hidden");
  els.setup.classList.remove("hidden");
  window.scrollTo(0, 0);
  console.log("Game cleared");
});

// Rules panel
els.rulesBtn.addEventListener("click", async () => {
  if (els.rulesContent.innerHTML === "") {
    try {
      const response = await fetch("/gameplay-and-rules.md");
      const markdown = await response.text();
      els.rulesContent.innerHTML = marked.parse(markdown);
    } catch (err) {
      els.rulesContent.innerHTML = "<p>Error loading rules.</p>";
    }
  }
  els.rulesPanel.classList.remove("hidden");
});

els.closeRulesBtn.addEventListener("click", () => {
  els.rulesPanel.classList.add("hidden");
});

els.rulesPanel.addEventListener("click", (e) => {
  if (e.target === els.rulesPanel) {
    els.rulesPanel.classList.add("hidden");
  }
});

// try restore from localStorage
(function init() {
  const saved = JSON.parse(localStorage.getItem("esl_creds") || "null");
  if (saved?.gameId && saved?.playerToken) setCreds(saved.gameId, saved.playerToken);

  // Check for join parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const joinGameId = urlParams.get("join");
  if (joinGameId) {
    // Auto-join the game
    els.joinGameId.value = joinGameId;
    setTimeout(() => els.joinBtn.click(), 100);
  }

  // persist changes
  const persist = () => localStorage.setItem("esl_creds", JSON.stringify({ gameId: state.gameId, playerToken: state.playerToken }));
  window.addEventListener("beforeunload", persist);
})();
