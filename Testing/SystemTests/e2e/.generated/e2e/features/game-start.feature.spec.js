// Generated from: e2e/features/game-start.feature
import { test } from "playwright-bdd";

test.describe('Starta ett spel', () => {

  test('En spelare startar ett nytt spel', async ({ Given, When, Then, page }) => { 
    await Given('att jag är på startsidan', null, { page }); 
    await When('jag startar ett nytt spel', null, { page }); 
    await Then('ska jag se att spelet är skapat', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('e2e/features/game-start.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given att jag är på startsidan","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When jag startar ett nytt spel","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then ska jag se att spelet är skapat","stepMatchArguments":[]}]},
]; // bdd-data-end