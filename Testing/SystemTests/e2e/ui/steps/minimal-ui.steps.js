import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();
const And = Then;

const state = {
  gameId: '',
  playerOneToken: '',
  playerTwoToken: '',
};

Given('I open the minimal demo app', async ({ page }) => {
  state.gameId = '';
  state.playerOneToken = '';
  state.playerTwoToken = '';
  await page.goto('/');
});

Then('I see the app title {string}', async ({ page }, expectedTitle) => {
  await expect(page.getByTestId('app-title')).toHaveText(expectedTitle);
});

Then('the gameplay rules document is available', async ({ request }) => {
  const response = await request.get('/gameplay-and-rules.md');

  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain('## Overview');
  expect(body).toContain('## Claim / Dispute Rules');
});

When('I create a game as {string}', async ({ page }, playerName) => {
  await page.getByTestId('player-name-input').fill(playerName);
  await page.getByTestId('create-game-btn').click();

  await expect(page.getByText('Game created. Share the game ID with the second player.')).toBeVisible();

  const gameId = (await page.getByTestId('game-id-value').textContent())?.trim() ?? '';
  const playerOneToken = (await page.getByTestId('player-id-value').textContent())?.trim() ?? '';

  expect(gameId).not.toEqual('');
  expect(gameId).not.toEqual('No active game');
  expect(playerOneToken).not.toEqual('');
  expect(playerOneToken).not.toEqual('Not assigned yet');

  state.gameId = gameId;
  state.playerOneToken = playerOneToken;
});

When('another player {string} joins the same game via API', async ({ request }, playerName) => {
  const response = await request.post(`/games/${state.gameId}/join`, {
    params: { playerName },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();

  expect(body.gameId).toBe(state.gameId);
  expect(body.playerId).toBeTruthy();
  state.playerTwoToken = body.playerId;
});

Then('the game status should be {string}', async ({ page }, expectedStatus) => {
  await page.getByTestId('refresh-btn').click();
  await expect(page.getByTestId('game-status')).toHaveText(expectedStatus);
});

When('I play letter {string}', async ({ page }, letter) => {
  await page.getByTestId('letter-input').fill(letter);
  await page.getByTestId('play-letter-btn').click();
});

When('I claim the current word', async ({ page }) => {
  await page.getByRole('button', { name: 'Claim word' }).click();
});

Then('the current word should be {string}', async ({ page }, expectedWord) => {
  await expect(page.getByTestId('current-word')).toHaveText(expectedWord);
});

Then('the pending claim word should be {string}', async ({ page }, expectedWord) => {
  await expect(page.locator('.notice').filter({ hasText: `claimed ${expectedWord}.` }).first()).toBeVisible();
});

Then('the turn note should be {string}', async ({ page }, expectedNote) => {
  await expect(page.getByTestId('turn-note')).toHaveText(expectedNote);
});

Then('player {string} should have score {int}', async ({ page }, playerName, expectedScore) => {
  const playerCard = page.locator('.player-card').filter({ has: page.getByText(playerName) });
  await expect(playerCard).toContainText(`Score: ${expectedScore}`);
});

When('another player plays letter {string} via API', async ({ request }, letter) => {
  const response = await request.post(`/games/${state.gameId}/letter`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Player-Token': state.playerTwoToken,
    },
    data: { letter },
  });

  expect(response.status()).toBe(200);
});

When('I refresh the game state', async ({ page }) => {
  await page.getByTestId('refresh-btn').click();
});

When('the opponent accepts the pending claim via API', async ({ request }) => {
  const response = await request.post(`/games/${state.gameId}/accept`, {
    headers: {
      'X-Player-Token': state.playerTwoToken,
    },
  });

  expect(response.status()).toBe(200);
});
