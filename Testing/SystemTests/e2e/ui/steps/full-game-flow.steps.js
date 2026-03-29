import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import GamePage from '../pages/game.page.js';

const { Given, When, Then } = createBdd();
const And = Then;

const state = {
  gameP1: null,
  gameP2: null,
  gameId: null,
  p1Token: null,
  p2Token: null,
  latestApiState: null,
};

async function getStoredToken(page) {
  return page.evaluate(() => {
    const raw = window.sessionStorage.getItem('esl_player') ?? window.localStorage.getItem('esl_player');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  });
}

async function postJson(request, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['X-Player-Token'] = token;
  return request.post(url, { data: body, headers });
}

async function postNoBody(request, url, token) {
  const headers = {};
  if (token) headers['X-Player-Token'] = token;
  return request.post(url, { headers });
}

async function getState(request, baseURL, gameId) {
  const res = await request.get(`${baseURL}/games/${gameId}`);
  expect(res.status()).toBe(200);
  return res.json();
}

Given('två spelare startar ett nytt spel i UI', async ({ page, browser }) => {
  state.gameP1 = new GamePage(page);
  await state.gameP1.goto();
  await state.gameP1.startNewGame('Player 1');
  await state.gameP1.expectGameCreated();
  state.gameId = await state.gameP1.getGameId();
  state.p1Token = await getStoredToken(page);

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  state.gameP2 = new GamePage(page2);
  await state.gameP2.goto();
  await state.gameP2.joinGameById(state.gameId, 'Player 2');

  await state.gameP1.waitForStatus('InProgress');
  await state.gameP2.waitForStatus('InProgress');
  state.p2Token = await getStoredToken(page2);
});

When('spelare 1 spelar bokstäver C A T \\(3 bokstäver\\)', async () => {
  await state.gameP1.playLetter('c');
  await state.gameP2.playLetter('a');
  await state.gameP1.playLetter('t');
});

Then('visar gränssnittet ordet CAT med bokstäver som tiles', async () => {
  await state.gameP1.waitForWordTiles('CAT');
  const tiles = await state.gameP1.page.getByTestId('word-tile').count();
  expect(tiles).toBe(3);
});

When('spelare 1 claimar ordet', async () => {
  await state.gameP1.claimWord();
});

Then('visar gränssnittet status PendingDispute', async () => {
  await state.gameP1.waitForStatus('PendingDispute');
  const status = await state.gameP1.getStatus();
  expect(status).toBe('PendingDispute');
});

And('visas ordet som pending', async () => {
  const pending = await state.gameP1.getPendingWordText();
  expect(pending).toContain('CAT');
});

And('disputeknappen är tillgänglig för spelare 2', async () => {
  await expect(state.gameP2.page.getByTestId('dispute-btn')).toBeVisible();
  const disabled = await state.gameP2.isDisputeButtonDisabled();
  expect(disabled).toBe(false);
});

When('spelare 2 accepterar', async () => {
  await state.gameP2.acceptClaim();
  await state.gameP1.waitForStatus('InProgress');
});

Then('visar gränssnittet spelare 1 får 4 poäng \\(2² när p1 lade C och T\\)', async () => {
  const score = await state.gameP1.getPlayer1Score();
  expect(score).toBe(4);
});

And('ordet återställs till tomt', async () => {
  const wordCount = await state.gameP1.getCurrentWordCountText();
  expect(wordCount).toContain('0 letter');
});

When('spela flera runor tills båda spelarna har färre accepts', async () => {
  await state.gameP2.playLetter('c');
  await state.gameP1.playLetter('a');
  await state.gameP2.playLetter('t');
  await state.gameP2.claimWord();
  await state.gameP1.acceptClaim();
  await state.gameP1.waitForStatus('InProgress');
});

Then('spelet visar rätt poängställning efter varje round', async () => {
  const p1Score = await state.gameP1.getPlayer1Score();
  const p2Score = await state.gameP1.getPlayer2Score();
  expect(p1Score).toBeGreaterThanOrEqual(0);
  expect(p2Score).toBeGreaterThanOrEqual(0);
});

When('båda spelarna förbrukar alla accepts', async ({ request, baseURL }) => {
  const maxRounds = 30;
  for (let i = 0; i < maxRounds; i++) {
    const current = await getState(request, baseURL, state.gameId);
    if (current.status === 'Finished') {
      state.latestApiState = current;
      return;
    }

    const active = current.activePlayerId;
    const claimerToken = active;
    const responderToken = claimerToken === state.p1Token ? state.p2Token : state.p1Token;

    const r1 = await postJson(request, `${baseURL}/games/${state.gameId}/letter`, { letter: 'c' }, claimerToken);
    expect(r1.status()).toBe(200);
    const r2 = await postJson(request, `${baseURL}/games/${state.gameId}/letter`, { letter: 'a' }, responderToken);
    expect(r2.status()).toBe(200);
    const r3 = await postJson(request, `${baseURL}/games/${state.gameId}/letter`, { letter: 't' }, claimerToken);
    expect(r3.status()).toBe(200);

    const claimRes = await postNoBody(request, `${baseURL}/games/${state.gameId}/claim`, claimerToken);
    expect(claimRes.status()).toBe(200);

    const responder = current.players?.find((p) => p.playerId === responderToken);
    const responderAccepts = responder?.acceptsRemaining ?? 0;
    const endpoint = responderAccepts > 0 ? 'accept' : 'dispute';

    const responseRes = await postNoBody(request, `${baseURL}/games/${state.gameId}/${endpoint}`, responderToken);
    expect(responseRes.status()).toBe(200);
    state.latestApiState = await responseRes.json();
  }

  throw new Error('Game did not reach Finished within the allotted rounds');
});

Then('visar gränssnittet status Finished', async () => {
  await state.gameP1.waitForStatus('Finished', 20000);
  const status = await state.gameP1.getStatus();
  expect(status).toBe('Finished');
});

And('visar vinnare eller oavgjort', async () => {
  const p1Score = await state.gameP1.getPlayer1Score();
  const p2Score = await state.gameP1.getPlayer2Score();
  expect(Number.isNaN(p1Score)).toBe(false);
  expect(Number.isNaN(p2Score)).toBe(false);
});

Given('ett spel i progress med två spelare', async ({ page, browser }) => {
  state.gameP1 = new GamePage(page);
  await state.gameP1.goto();
  await state.gameP1.startNewGame('Player 1');
  await state.gameP1.expectGameCreated();
  state.gameId = await state.gameP1.getGameId();

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  state.gameP2 = new GamePage(page2);
  await state.gameP2.goto();
  await state.gameP2.joinGameById(state.gameId, 'Player 2');
  await state.gameP1.waitForStatus('InProgress');
  await state.gameP2.waitForStatus('InProgress');
});

When('spelare 1 bygger CAT och claimar', async () => {
  await state.gameP1.playLetter('c');
  await state.gameP2.playLetter('a');
  await state.gameP1.playLetter('t');
  await state.gameP1.claimWord();
  await state.gameP1.waitForStatus('PendingDispute');
});

Then('visar accept-knappen med 5 kvar för spelare 2', async () => {
  const text = await state.gameP2.getAcceptButtonText();
  expect(text).toContain('(5 left)');
});

When('spelare 1 bygger CATS och claimar igen', async () => {
  await state.gameP2.playLetter('c');
  await state.gameP1.playLetter('a');
  await state.gameP2.playLetter('t');
  await state.gameP1.playLetter('s');
  await state.gameP1.claimWord();
  await state.gameP1.waitForStatus('PendingDispute');
});

Then('visar accept-knappen med 4 kvar för spelare 2', async () => {
  const text = await state.gameP2.getAcceptButtonText();
  expect(text).toContain('(4 left)');
});

Then('visar dispute-knappen med 5 kvar för spelare 2', async () => {
  const text = await state.gameP2.getDisputeButtonText();
  expect(text).toContain('(5 left)');
});

When('spelare 2 bestrider \\(motsättningsord\\)', async () => {
  await state.gameP2.disputeClaim();
  await state.gameP1.waitForStatus('InProgress');
});

Then('visar dispute-knappen med 4 kvar för spelare 2', async () => {
  const text = await state.gameP2.getDisputeButtonText();
  expect(text).toContain('(4 left)');
});

Given('ett spel där spelare 1 låg sista bokstaven', async ({ page, browser }) => {
  state.gameP1 = new GamePage(page);
  await state.gameP1.goto();
  await state.gameP1.startNewGame('Player 1');
  await state.gameP1.expectGameCreated();
  state.gameId = await state.gameP1.getGameId();

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  state.gameP2 = new GamePage(page2);
  await state.gameP2.goto();
  await state.gameP2.joinGameById(state.gameId, 'Player 2');
  await state.gameP1.waitForStatus('InProgress');

  // P1 plays C, P2 plays A, P1 plays T (P1 last)
  await state.gameP1.playLetter('c');
  await state.gameP2.playLetter('a');
  await state.gameP1.playLetter('t');
});

Then('visar gränssnittet claim-knappen som tillgänglig för spelare 1', async () => {
  await expect(state.gameP1.page.getByTestId('claim-btn')).toBeVisible();
});

And('visar claim-knappen som inte tillgänglig för spelare 2', async () => {
  await expect(state.gameP2.page.getByTestId('claim-btn')).toHaveCount(0);
});

Given('ett spel med två bokstäver i ordet', async ({ page, browser }) => {
  state.gameP1 = new GamePage(page);
  await state.gameP1.goto();
  await state.gameP1.startNewGame('Player 1');
  state.gameId = await state.gameP1.getGameId();

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  state.gameP2 = new GamePage(page2);
  await state.gameP2.goto();
  await state.gameP2.joinGameById(state.gameId, 'Player 2');
  await state.gameP1.waitForStatus('InProgress');

  // P1 plays C, P2 plays A (only 2 letters)
  await state.gameP1.playLetter('c');
  await state.gameP2.playLetter('a');
});

Then('visar claim-knappen som inte tillgänglig för båda spelarna', async () => {
  await expect(state.gameP1.page.getByTestId('claim-btn')).toHaveCount(0);
  await expect(state.gameP2.page.getByTestId('claim-btn')).toHaveCount(0);
});

Given('ett spel i progress', async ({ page, browser }) => {
  state.gameP1 = new GamePage(page);
  await state.gameP1.goto();
  await state.gameP1.startNewGame('Player 1');
  state.gameId = await state.gameP1.getGameId();

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  state.gameP2 = new GamePage(page2);
  await state.gameP2.goto();
  await state.gameP2.joinGameById(state.gameId, 'Player 2');
  await state.gameP1.waitForStatus('InProgress');
});

When('spelare 1 lägger H', async () => {
  await state.gameP1.playLetter('h');
});

Then('visar gränssnittet bokstaven H som en tile', async () => {
  await state.gameP1.waitForWordTiles('H');
});

When('spelare 2 lägger E', async () => {
  await state.gameP2.playLetter('e');
});

Then('visar gränssnittet bokstäver H och E som tiles', async () => {
  await state.gameP1.waitForWordTiles('HE');
});

Then('visar scoreboard {string} och {string} för spelare {int}', async ({}, expectedP1, expectedP2, playerNumber) => {
  const game = playerNumber === 1 ? state.gameP1 : state.gameP2;
  const p1Label = await game.getPlayer1Label();
  const p2Label = await game.getPlayer2Label();
  expect(p1Label).toBe(expectedP1);
  expect(p2Label).toBe(expectedP2);
});
