import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, Then } = createBdd();

const state = {
  gameId: null,
  player1Token: null,
  player2Token: null,
};

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

Given('ett nytt spel där spelare 1 har lagt senaste bokstaven', async ({ request, baseURL }) => {
  const createRes = await postNoBody(request, `${baseURL}/games`);
  expect(createRes.status()).toBe(201);
  const createData = await createRes.json();

  const gameId = createData.gameId;
  const player1Token = createData.playerToken;

  const joinRes = await postNoBody(request, `${baseURL}/games/${gameId}/join`);
  expect(joinRes.status()).toBe(200);
  const joinData = await joinRes.json();

  const player2Token = joinData.playerToken;

  const letterRes = await postJson(
    request,
    `${baseURL}/games/${gameId}/letter`,
    { letter: 't' },
    player1Token
  );
  expect(letterRes.status()).toBe(200);

  state.gameId = gameId;
  state.player1Token = player1Token;
  state.player2Token = player2Token;
});

Then('spelare 2 ser claim-knappen som inaktiverad', async ({ page }) => {
  await page.addInitScript((creds) => {
    window.localStorage.setItem('esl_creds', JSON.stringify(creds));
  }, { gameId: state.gameId, playerToken: state.player2Token });

  await page.goto('/');

  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#claimBtn')).toBeDisabled();
});

Then('spelare 1 ser claim-knappen som inaktiverad under minimiordlängd', async ({ page }) => {
  await page.addInitScript((creds) => {
    window.localStorage.setItem('esl_creds', JSON.stringify(creds));
  }, { gameId: state.gameId, playerToken: state.player1Token });

  await page.goto('/');

  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#claimBtn')).toBeDisabled();
});