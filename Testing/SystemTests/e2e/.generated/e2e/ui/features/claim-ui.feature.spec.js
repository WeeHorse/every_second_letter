// Generated from: e2e/ui/features/claim-ui.feature
import { test } from "playwright-bdd";

test.describe('Claim button UI restriction', () => {

  test('Opponent sees claim button disabled after your letter', async ({ Given, Then, baseURL, page, request }) => { 
    await Given('ett nytt spel där spelare 1 har lagt senaste bokstaven', null, { baseURL, request }); 
    await Then('spelare 2 ser claim-knappen som inaktiverad', null, { page }); 
  });

  test('Last-letter player still sees claim disabled before minimum length', async ({ Given, Then, baseURL, page, request }) => { 
    await Given('ett nytt spel där spelare 1 har lagt senaste bokstaven', null, { baseURL, request }); 
    await Then('spelare 1 ser claim-knappen som inaktiverad under minimiordlängd', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('e2e/ui/features/claim-ui.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given ett nytt spel där spelare 1 har lagt senaste bokstaven","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Outcome","textWithKeyword":"Then spelare 2 ser claim-knappen som inaktiverad","stepMatchArguments":[]}]},
  {"pwTestLine":11,"pickleLine":7,"tags":[],"steps":[{"pwStepLine":12,"gherkinStepLine":8,"keywordType":"Context","textWithKeyword":"Given ett nytt spel där spelare 1 har lagt senaste bokstaven","stepMatchArguments":[]},{"pwStepLine":13,"gherkinStepLine":9,"keywordType":"Outcome","textWithKeyword":"Then spelare 1 ser claim-knappen som inaktiverad under minimiordlängd","stepMatchArguments":[]}]},
]; // bdd-data-end