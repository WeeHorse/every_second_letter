import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

const state = {
  gameId: null,
  p1: null,
  p2: null,
  lastResponse: null,
};

async function parseResponse(res) {
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { status: res.status(), body };
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

async function buildWord(request, baseURL, gameId, p1, p2, letters) {
  const turnOrder = [p1, p2, p1, p2, p1, p2];
  for (let i = 0; i < letters.length; i++) {
    const res = await postJson(
      request,
      `${baseURL}/games/${gameId}/letter`,
      { letter: letters[i] },
      turnOrder[i]
    );
    expect(res.status()).toBe(200);
  }
}

async function claimWord(request, baseURL, gameId, token) {
  const claimRes = await postNoBody(request, `${baseURL}/games/${gameId}/claim`, token);
  return parseResponse(claimRes);
}

Given('ett nytt API-spel med två spelare', async ({ request, baseURL }) => {
  const createRes = await postNoBody(request, `${baseURL}/games`);
  expect(createRes.status()).toBe(201);
  const createData = await createRes.json();

  const joinRes = await postNoBody(request, `${baseURL}/games/${createData.gameId}/join`);
  expect(joinRes.status()).toBe(200);
  const joinData = await joinRes.json();

  state.gameId = createData.gameId;
  state.p1 = createData.playerToken;
  state.p2 = joinData.playerToken;
  state.lastResponse = null;
});

Then('spelare 2 nekas att lägga bokstav innan spelare 1 har spelat', async ({ request, baseURL }) => {
  const res = await postJson(
    request,
    `${baseURL}/games/${state.gameId}/letter`,
    { letter: 'x' },
    state.p2
  );

  const parsed = await parseResponse(res);
  expect(parsed.status).toBe(409);
  expect((parsed.body?.error ?? '')).toContain('Not your turn');
});

Then('ogiltiga bokstavsinmatningar nekas', async ({ request, baseURL }) => {
  const tooLong = await postJson(
    request,
    `${baseURL}/games/${state.gameId}/letter`,
    { letter: 'ab' },
    state.p1
  );
  const tooLongParsed = await parseResponse(tooLong);
  expect(tooLongParsed.status).toBe(400);

  const nonLetter = await postJson(
    request,
    `${baseURL}/games/${state.gameId}/letter`,
    { letter: '1' },
    state.p1
  );
  const nonLetterParsed = await parseResponse(nonLetter);
  expect(nonLetterParsed.status).toBe(400);
});

When('spelare 1 och 2 bygger ordet till två bokstäver', async ({ request, baseURL }) => {
  await buildWord(request, baseURL, state.gameId, state.p1, state.p2, ['t', 'e']);
});

Then('claim nekas på för kort ord', async ({ request, baseURL }) => {
  const parsed = await claimWord(request, baseURL, state.gameId, state.p2);
  expect(parsed.status).toBe(409);
  expect((parsed.body?.error ?? '')).toContain('at least 3');
});

When('spelare 1 bygger TES och claimar ordet', async ({ request, baseURL }) => {
  await buildWord(request, baseURL, state.gameId, state.p1, state.p2, ['t', 'e', 's']);
  const parsed = await claimWord(request, baseURL, state.gameId, state.p1);
  expect(parsed.status).toBe(200);
  expect(parsed.body?.status).toBe('PendingDispute');
  state.lastResponse = parsed.body;
});

Then('inga fler bokstäver kan spelas under pending dispute', async ({ request, baseURL }) => {
  const res = await postJson(
    request,
    `${baseURL}/games/${state.gameId}/letter`,
    { letter: 'x' },
    state.p2
  );

  const parsed = await parseResponse(res);
  expect(parsed.status).toBe(409);
  expect((parsed.body?.error ?? '')).toContain('not in progress');
});

Then('claimaren får inte acceptera eller bestrida sitt eget claim', async ({ request, baseURL }) => {
  const acceptRes = await postNoBody(request, `${baseURL}/games/${state.gameId}/accept`, state.p1);
  const acceptParsed = await parseResponse(acceptRes);
  expect(acceptParsed.status).toBe(409);
  expect((acceptParsed.body?.error ?? '')).toContain('Only the opponent');

  const disputeRes = await postNoBody(request, `${baseURL}/games/${state.gameId}/dispute`, state.p1);
  const disputeParsed = await parseResponse(disputeRes);
  expect(disputeParsed.status).toBe(409);
  expect((disputeParsed.body?.error ?? '')).toContain('Only the opponent');
});

When('spelare 1 bygger CAT och claimar ordet', async ({ request, baseURL }) => {
  await buildWord(request, baseURL, state.gameId, state.p1, state.p2, ['c', 'a', 't']);
  const parsed = await claimWord(request, baseURL, state.gameId, state.p1);
  expect(parsed.status).toBe(200);
  expect(parsed.body?.status).toBe('PendingDispute');
});

When('spelare 2 bestrider claimet', async ({ request, baseURL }) => {
  const disputeRes = await postNoBody(request, `${baseURL}/games/${state.gameId}/dispute`, state.p2);
  const parsed = await parseResponse(disputeRes);
  expect(parsed.status).toBe(200);
  state.lastResponse = parsed.body;
});

Then('poängen följer regeln för giltigt ord vid dispute', async () => {
  expect(state.lastResponse.status).toBe('InProgress');
  expect(state.lastResponse.player1Score).toBe(6);
  expect(state.lastResponse.player2Score).toBe(0);
  expect(state.lastResponse.wordHistory.length).toBe(1);
  expect(state.lastResponse.wordHistory[0].word).toBe('CAT');
  expect(state.lastResponse.wordHistory[0].isValid).toBe(true);
});

Then('poängen följer regeln för ogiltigt ord vid dispute', async () => {
  expect(state.lastResponse.status).toBe('InProgress');
  expect(state.lastResponse.player1Score).toBe(0);
  expect(state.lastResponse.player2Score).toBe(2);
  expect(state.lastResponse.wordHistory.length).toBe(1);
  expect(state.lastResponse.wordHistory[0].word).toBe('TES');
  expect(state.lastResponse.wordHistory[0].isValid).toBe(false);
});

When('båda spelare förbrukar alla accepts och disputes', async ({ request, baseURL }) => {
  for (let i = 0; i < 5; i++) {
    await buildWord(request, baseURL, state.gameId, state.p1, state.p2, ['t', 'e', 's']);
    let claim = await claimWord(request, baseURL, state.gameId, state.p1);
    expect(claim.status).toBe(200);
    let accept = await postNoBody(request, `${baseURL}/games/${state.gameId}/accept`, state.p2);
    expect(accept.status()).toBe(200);

    await buildWord(request, baseURL, state.gameId, state.p2, state.p1, ['t', 'e', 's']);
    claim = await claimWord(request, baseURL, state.gameId, state.p2);
    expect(claim.status).toBe(200);
    accept = await postNoBody(request, `${baseURL}/games/${state.gameId}/accept`, state.p1);
    expect(accept.status()).toBe(200);
  }

  for (let i = 0; i < 5; i++) {
    await buildWord(request, baseURL, state.gameId, state.p1, state.p2, ['t', 'e', 's']);
    let claim = await claimWord(request, baseURL, state.gameId, state.p1);
    expect(claim.status).toBe(200);
    let dispute = await postNoBody(request, `${baseURL}/games/${state.gameId}/dispute`, state.p2);
    expect(dispute.status()).toBe(200);

    await buildWord(request, baseURL, state.gameId, state.p2, state.p1, ['t', 'e', 's']);
    claim = await claimWord(request, baseURL, state.gameId, state.p2);
    expect(claim.status).toBe(200);
    dispute = await postNoBody(request, `${baseURL}/games/${state.gameId}/dispute`, state.p1);
    expect(dispute.status()).toBe(200);
    state.lastResponse = await dispute.json();
  }
});

Then('spelet är finished och har en vinnare eller oavgjort', async () => {
  expect(state.lastResponse.status).toBe('Finished');
  const hasWinnerOrTie =
    state.lastResponse.player1Score >= state.lastResponse.player2Score ||
    state.lastResponse.player2Score >= state.lastResponse.player1Score;
  expect(hasWinnerOrTie).toBe(true);
  expect(state.lastResponse.player1Accepts).toBe(0);
  expect(state.lastResponse.player1Disputes).toBe(0);
  expect(state.lastResponse.player2Accepts).toBe(0);
  expect(state.lastResponse.player2Disputes).toBe(0);
});