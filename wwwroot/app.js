const els = {
  createBtn: document.getElementById("createBtn"),
  joinBtn: document.getElementById("joinBtn"),
  joinGameId: document.getElementById("joinGameId"),
  debugToggleBtn: document.getElementById("debugToggleBtn"),
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
  youOut: document.getElementById("youOut"),
  standingOut: document.getElementById("standingOut"),

  rulesBtn: document.getElementById("rulesBtn"),
  rulesPanel: document.getElementById("rulesPanel"),
  closeRulesBtn: document.getElementById("closeRulesBtn"),
  rulesContent: document.getElementById("rulesContent"),

  wordHistory: document.getElementById("wordHistory"),
  log: document.getElementById("log"),
};

const debugEls = Array.from(document.querySelectorAll(".debug"));
const DEBUG_STORAGE_KEY = "esl_debug_visible";

let state = {
  gameId: null,
  playerToken: null,
  game: null,
  pollTimer: null,
  previousGame: null,
  debugVisible: false,
};

function setDebugVisible(isVisible) {
  state.debugVisible = isVisible;
  document.body.classList.toggle("debug-visible", isVisible);
  debugEls.forEach((element) => {
    element.classList.toggle("debug-hidden", !isVisible);
  });
  els.debugToggleBtn.setAttribute("aria-pressed", String(isVisible));
  els.debugToggleBtn.textContent = isVisible ? "Debug on" : "Debug off";

  try {
    localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(isVisible));
  } catch {
    // Ignore storage failures and keep the toggle working for this session.
  }
}

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  els.log.textContent = `[${ts}] ${msg}\n` + els.log.textContent;
}

function setCreds(gameId, playerToken) {
  state.gameId = gameId;
  state.playerToken = playerToken;
  state.previousGame = null;

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

  state.previousGame = JSON.parse(JSON.stringify(game));

  // status display with winner when finished
  if (game.status === "Finished") {
    let winner = "Tie";
    if (game.player1Score > game.player2Score) winner = "Player 1";
    else if (game.player2Score > game.player1Score) winner = "Player 2";
    els.statusOut.textContent = `Finished (${winner} wins)`;
  } else {
    els.statusOut.textContent = game.status;
  }

  // Display "Player 1" or "Player 2" in the marquee
  let activePlayerDisplay = "-";
  if (game.activePlayerId === game.player1Id) {
    activePlayerDisplay = "Player 1";
  } else if (game.activePlayerId === game.player2Id) {
    activePlayerDisplay = "Player 2";
  }
  els.activeMarquee.textContent = activePlayerDisplay;

  // show which player you are
  let you = "-";
  if (state.playerToken === game.player1Id) you = "Player 1";
  else if (state.playerToken === game.player2Id) you = "Player 2";
  els.youOut.textContent = you;

  // standings text
  let standing = "";
  if (game.player1Score > game.player2Score) standing = `P1 +${game.player1Score - game.player2Score}`;
  else if (game.player2Score > game.player1Score) standing = `P2 +${game.player2Score - game.player1Score}`;
  else standing = "even";
  els.standingOut.textContent = standing;

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

  // update accept/dispute button labels with remaining counts
  if (game.player1Id && game.player2Id) {
    // determine opponent counts for current user if responding
    const isP1 = state.playerToken === game.player1Id;
    const acceptsLeft = isP1 ? game.player1Accepts : game.player2Accepts;
    const disputesLeft = isP1 ? game.player1Disputes : game.player2Disputes;
    els.acceptBtn.textContent = `Accept (${acceptsLeft})`;
    els.disputeBtn.textContent = `Dispute (${disputesLeft})`;
    // disable if none left
    els.acceptBtn.disabled = acceptsLeft <= 0;
    els.disputeBtn.disabled = disputesLeft <= 0;
  }

  els.disputeRow.classList.toggle("hidden", !canRespond);

  const myTurn = state.playerToken &&
    game.activePlayerId === state.playerToken &&
    game.status === "InProgress";

  const canClaimAfterLast =
    state.playerToken &&
    game.status === "InProgress" &&
    game.lastLetterPlayerId === state.playerToken;

  const meetsMinLength =
    game.currentWord &&
    game.currentWord.length >= 3;

  els.playBtn.disabled = !myTurn;
  els.letterIn.disabled = !myTurn;

  // Claim är tillåtet endast om du var den som la senaste bokstaven och ordet nått minlängd
  els.claimBtn.disabled = !(canClaimAfterLast && meetsMinLength) || game.status === "Finished";
  // play/letter already disabled above

  if (myTurn && game.status !== "Finished") els.letterIn.focus();

  renderWordHistory();

  // if game over, stop polling to freeze state
  if (game.status === "Finished" && state.pollTimer) {
    stopPolling();
  }
}

function renderWordHistory() {
  els.wordHistory.innerHTML = "";

  if (!state.game || !state.game.wordHistory || state.game.wordHistory.length === 0) {
    els.wordHistory.innerHTML = '<div class="word-history-empty">No completed words yet</div>';
    return;
  }

  state.game.wordHistory.forEach((entry, idx) => {
    const item = document.createElement("div");
    item.className = "word-history-item";

    const word = document.createElement("span");
    word.className = "word-history-word";
    word.textContent = entry.word.toUpperCase();

    const meta = document.createElement("span");
    meta.className = "word-history-meta";

    // figure out who actually scored points
    let scorer = "-";
    let scoredPoints = 0;
    if (entry.player1Points > entry.player2Points) {
      scorer = "Player 1";
      scoredPoints = entry.player1Points;
    } else if (entry.player2Points > entry.player1Points) {
      scorer = "Player 2";
      scoredPoints = entry.player2Points;
    }

    if (scoredPoints > 0) {
      meta.textContent = `${scorer} +${scoredPoints}`;
    } else {
      meta.textContent = "Disputed";
    }

    const validity = document.createElement("span");
    validity.className = "word-history-validity";

    if (entry.isValid === true) {
      validity.className += " valid";
      validity.textContent = "✓";
    } else if (entry.isValid === false) {
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
    const priorToken = state.playerToken;
    const res = await api(`/games/${gid}/join`, { method: "POST" });
    setCreds(res.gameId, res.playerToken);
    // Clear and update localStorage with the new player's credentials
    localStorage.setItem("esl_creds", JSON.stringify({ gameId: res.gameId, playerToken: res.playerToken }));
    const isRejoin = !!priorToken && priorToken === res.playerToken;
    log(isRejoin ? `Rejoined game ${res.gameId}` : `Joined game ${res.gameId}`);
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

els.debugToggleBtn.addEventListener("click", () => {
  setDebugVisible(!state.debugVisible);
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
  let savedDebugVisible = false;
  try {
    savedDebugVisible = JSON.parse(localStorage.getItem(DEBUG_STORAGE_KEY) || "false");
  } catch {
    savedDebugVisible = false;
  }
  setDebugVisible(savedDebugVisible);

  const saved = JSON.parse(localStorage.getItem("esl_creds") || "null");
  const hasRestoredCreds = saved?.gameId && saved?.playerToken;

  if (hasRestoredCreds) setCreds(saved.gameId, saved.playerToken);

  // Check for join parameter in URL
  // Only auto-join if credentials were NOT already restored from localStorage
  // (prevents attempting to join a game we're already part of)
  const urlParams = new URLSearchParams(window.location.search);
  const joinGameId = urlParams.get("join");
  if (joinGameId && !hasRestoredCreds) {
    // Auto-join the game
    els.joinGameId.value = joinGameId;
    setTimeout(() => els.joinBtn.click(), 100);
  }

  // persist changes
  const persist = () => localStorage.setItem("esl_creds", JSON.stringify({ gameId: state.gameId, playerToken: state.playerToken }));
  window.addEventListener("beforeunload", persist);
})();
