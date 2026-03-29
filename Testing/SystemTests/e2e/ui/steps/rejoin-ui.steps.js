import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import GamePage from '../pages/game.page.js';

const { Given, When, Then } = createBdd();
const And = Then;

const state = {
  gameP1: null,
  gameP2: null,
  gameId: null,
  p2SavedPlayer: null,
  p2SavedGame: null,
  beforeRefreshP1Score: 0,
  beforeRefreshP2Score: 0,
};

Given('ett spel där både spelarna är aktiva', async ({ page, browser }) => {
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

  state.beforeRefreshP1Score = await state.gameP2.getPlayer1Score();
  state.beforeRefreshP2Score = await state.gameP2.getPlayer2Score();

  state.p2SavedPlayer = await page2.evaluate(() => window.sessionStorage.getItem('esl_player') ?? window.localStorage.getItem('esl_player'));
  state.p2SavedGame = await page2.evaluate(() => window.sessionStorage.getItem('esl_game') ?? window.localStorage.getItem('esl_game'));
});

When('spelare 2 uppdaterar sidan \\(browser refresh\\)', async () => {
  await state.gameP2.refreshPage();
});

Then('återställs spelet automatiskt till samma state', async () => {
  await expect(state.gameP2.page.getByTestId('game-active-card')).toBeVisible();
  await expect(state.gameP2.page.getByTestId('game-status')).toHaveText('InProgress');
});

And('spelers stats förblir oförändrade', async () => {
  const p1Score = await state.gameP2.getPlayer1Score();
  const p2Score = await state.gameP2.getPlayer2Score();
  expect(p1Score).toBe(state.beforeRefreshP1Score);
  expect(p2Score).toBe(state.beforeRefreshP2Score);
});

Given('ett spel med två aktiva spelare', async ({ page, browser }) => {
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

  state.p2SavedPlayer = await page2.evaluate(() => window.sessionStorage.getItem('esl_player') ?? window.localStorage.getItem('esl_player'));
  state.p2SavedGame = await page2.evaluate(() => window.sessionStorage.getItem('esl_game') ?? window.localStorage.getItem('esl_game'));
});

When('spelare 2 öppnar appen i nytt fönster med sparade credentials', async ({ browser }) => {
  const context3 = await browser.newContext();
  await context3.addInitScript(({ savedPlayer, savedGame }) => {
    if (savedPlayer) {
      window.sessionStorage.setItem('esl_player', savedPlayer);
      window.localStorage.setItem('esl_player', savedPlayer);
    }
    if (savedGame) {
      window.sessionStorage.setItem('esl_game', savedGame);
      window.localStorage.setItem('esl_game', savedGame);
    }
  }, {
    savedPlayer: state.p2SavedPlayer,
    savedGame: state.p2SavedGame,
  });

  const page3 = await context3.newPage();
  state.gameP2 = new GamePage(page3);
  await state.gameP2.goto();
});

Then('visar gränssnittet spelet i samma status', async () => {
  await expect(state.gameP2.page.getByTestId('game-active-card')).toBeVisible();
  const status = await state.gameP2.getStatus();
  expect(status).toBe('InProgress');
});
