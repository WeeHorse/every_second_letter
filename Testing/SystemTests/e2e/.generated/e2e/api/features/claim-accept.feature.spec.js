// Generated from: e2e/api/features/claim-accept.feature
import { test } from "playwright-bdd";

test.describe('Claim and accept flow', () => {

  test('Claim followed by accept returns stable game state', async ({ Given, When, Then, baseURL, request }) => { 
    await Given('ett nytt spel med två spelare via API', null, { baseURL, request }); 
    await When('spelare 1 bygger ordet TES och claimar', null, { baseURL, request }); 
    await Then('spelare 2 accepterar utan serverfel och spelet återställs', null, { baseURL, request }); 
  });

  test('Opponent cannot claim your latest letter', async ({ Given, When, Then, baseURL, request }) => { 
    await Given('ett nytt spel med två spelare via API', null, { baseURL, request }); 
    await When('spelare 1 lägger en bokstav', null, { baseURL, request }); 
    await Then('spelare 2 kan inte claima ordet', null, { baseURL, request }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('e2e/api/features/claim-accept.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given ett nytt spel med två spelare via API","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When spelare 1 bygger ordet TES och claimar","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then spelare 2 accepterar utan serverfel och spelet återställs","stepMatchArguments":[]}]},
  {"pwTestLine":12,"pickleLine":8,"tags":[],"steps":[{"pwStepLine":13,"gherkinStepLine":9,"keywordType":"Context","textWithKeyword":"Given ett nytt spel med två spelare via API","stepMatchArguments":[]},{"pwStepLine":14,"gherkinStepLine":10,"keywordType":"Action","textWithKeyword":"When spelare 1 lägger en bokstav","stepMatchArguments":[]},{"pwStepLine":15,"gherkinStepLine":11,"keywordType":"Outcome","textWithKeyword":"Then spelare 2 kan inte claima ordet","stepMatchArguments":[]}]},
]; // bdd-data-end