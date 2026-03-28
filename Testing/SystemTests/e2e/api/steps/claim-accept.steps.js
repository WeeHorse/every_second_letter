import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

const state = {
  gameId: null,
  p1: null,
  p2: null,
  claimResponse: null,
  acceptResponse: null,
  blockedClaimStatus: null,
  blockedClaimBody: null,
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

Given('ett nytt spel med två spelare via API', async ({ request, baseURL }) => {
  const createRes = await postNoBody(request, `${baseURL}/games`);
  expect(createRes.status()).toBe(201);
  const createData = await createRes.json();

  state.gameId = createData.gameId;
  state.p1 = createData.playerToken;

  const joinRes = await postNoBody(request, `${baseURL}/games/${state.gameId}/join`);
  expect(joinRes.status()).toBe(200);
  const joinData = await joinRes.json();
  state.p2 = joinData.playerToken;
});

When('spelare 1 bygger ordet TES och claimar', async ({ request, baseURL }) => {
  const letters = [
    { token: state.p1, letter: 't' },
    { token: state.p2, letter: 'e' },
    { token: state.p1, letter: 's' },
  ];

  for (const move of letters) {
    const letterRes = await postJson(
      request,
      `${baseURL}/games/${state.gameId}/letter`,
      { letter: move.letter },
      move.token
    );
    expect(letterRes.status()).toBe(200);
  }

  const claimRes = await postNoBody(
    request,
    `${baseURL}/games/${state.gameId}/claim`,
    state.p1
  );
  expect(claimRes.status()).toBe(200);
  state.claimResponse = await claimRes.json();
});

Then('spelare 2 accepterar utan serverfel och spelet återställs', async ({ request, baseURL }) => {
  expect(state.claimResponse.status).toBe('PendingDispute');
  expect(state.claimResponse.pendingWord).toBe('TES');

  const acceptRes = await postNoBody(
    request,
    `${baseURL}/games/${state.gameId}/accept`,
    state.p2
  );

  expect(acceptRes.status()).toBe(200);
  state.acceptResponse = await acceptRes.json();

  expect(state.acceptResponse.status).toBe('InProgress');
  expect(state.acceptResponse.currentWord).toBe('');
  expect(state.acceptResponse.pendingWord).toBeNull();
  expect(state.acceptResponse.player2Accepts).toBe(4);
  expect(state.acceptResponse.wordHistory.length).toBe(1);
  expect(state.acceptResponse.wordHistory[0].word).toBe('TES');
});

When('spelare 1 lägger en bokstav', async ({ request, baseURL }) => {
  const letterRes = await postJson(
    request,
    `${baseURL}/games/${state.gameId}/letter`,
    { letter: 't' },
    state.p1
  );

  expect(letterRes.status()).toBe(200);
});

Then('spelare 2 kan inte claima ordet', async ({ request, baseURL }) => {
  const claimRes = await postNoBody(
    request,
    `${baseURL}/games/${state.gameId}/claim`,
    state.p2
  );

  state.blockedClaimStatus = claimRes.status();
  const blockedClaimText = await claimRes.text();

  let blockedClaimBody = null;
  try {
    blockedClaimBody = blockedClaimText ? JSON.parse(blockedClaimText) : null;
  } catch {
    blockedClaimBody = null;
  }

  state.blockedClaimBody = blockedClaimBody;

  expect(state.blockedClaimStatus).toBe(409);
  const errorText = state.blockedClaimBody?.error ?? blockedClaimText;
  expect(errorText).toContain('last letter');
});