// Generated from: e2e/api/features/rules-coverage.feature
import { test } from "playwright-bdd";

test.describe('Gameplay and rules coverage', () => {

  test('Wrong player cannot play out of turn', async ({ Given, Then, baseURL, request }) => { 
    await Given('ett nytt API-spel med två spelare', null, { baseURL, request }); 
    await Then('spelare 2 nekas att lägga bokstav innan spelare 1 har spelat', null, { baseURL, request }); 
  });

  test('Letter input must be exactly one valid letter', async ({ Given, Then, baseURL, request }) => { 
    await Given('ett nytt API-spel med två spelare', null, { baseURL, request }); 
    await Then('ogiltiga bokstavsinmatningar nekas', null, { baseURL, request }); 
  });

  test('Claim requires minimum three letters', async ({ Given, When, Then, baseURL, request }) => { 
    await Given('ett nytt API-spel med två spelare', null, { baseURL, request }); 
    await When('spelare 1 och 2 bygger ordet till två bokstäver', null, { baseURL, request }); 
    await Then('claim nekas på för kort ord', null, { baseURL, request }); 
  });

  test('Pending dispute blocks further letter play and claimer cannot resolve', async ({ Given, When, Then, And, baseURL, request }) => { 
    await Given('ett nytt API-spel med två spelare', null, { baseURL, request }); 
    await When('spelare 1 bygger TES och claimar ordet', null, { baseURL, request }); 
    await Then('inga fler bokstäver kan spelas under pending dispute', null, { baseURL, request }); 
    await And('claimaren får inte acceptera eller bestrida sitt eget claim', null, { baseURL, request }); 
  });

  test('Disputing a valid word gives claimer 150 percent', async ({ Given, When, Then, And, baseURL, request }) => { 
    await Given('ett nytt API-spel med två spelare', null, { baseURL, request }); 
    await When('spelare 1 bygger CAT och claimar ordet', null, { baseURL, request }); 
    await And('spelare 2 bestrider claimet', null, { baseURL, request }); 
    await Then('poängen följer regeln för giltigt ord vid dispute'); 
  });

  test('Disputing an invalid word gives opponent 50 percent', async ({ Given, When, Then, And, baseURL, request }) => { 
    await Given('ett nytt API-spel med två spelare', null, { baseURL, request }); 
    await When('spelare 1 bygger TES och claimar ordet', null, { baseURL, request }); 
    await And('spelare 2 bestrider claimet', null, { baseURL, request }); 
    await Then('poängen följer regeln för ogiltigt ord vid dispute'); 
  });

  test('Game ends when both players exhaust accepts and disputes', async ({ Given, When, Then, baseURL, request }) => { 
    await Given('ett nytt API-spel med två spelare', null, { baseURL, request }); 
    await When('båda spelare förbrukar alla accepts och disputes', null, { baseURL, request }); 
    await Then('spelet är finished och har en vinnare eller oavgjort'); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('e2e/api/features/rules-coverage.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given ett nytt API-spel med två spelare","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Outcome","textWithKeyword":"Then spelare 2 nekas att lägga bokstav innan spelare 1 har spelat","stepMatchArguments":[]}]},
  {"pwTestLine":11,"pickleLine":7,"tags":[],"steps":[{"pwStepLine":12,"gherkinStepLine":8,"keywordType":"Context","textWithKeyword":"Given ett nytt API-spel med två spelare","stepMatchArguments":[]},{"pwStepLine":13,"gherkinStepLine":9,"keywordType":"Outcome","textWithKeyword":"Then ogiltiga bokstavsinmatningar nekas","stepMatchArguments":[]}]},
  {"pwTestLine":16,"pickleLine":11,"tags":[],"steps":[{"pwStepLine":17,"gherkinStepLine":12,"keywordType":"Context","textWithKeyword":"Given ett nytt API-spel med två spelare","stepMatchArguments":[]},{"pwStepLine":18,"gherkinStepLine":13,"keywordType":"Action","textWithKeyword":"When spelare 1 och 2 bygger ordet till två bokstäver","stepMatchArguments":[]},{"pwStepLine":19,"gherkinStepLine":14,"keywordType":"Outcome","textWithKeyword":"Then claim nekas på för kort ord","stepMatchArguments":[]}]},
  {"pwTestLine":22,"pickleLine":16,"tags":[],"steps":[{"pwStepLine":23,"gherkinStepLine":17,"keywordType":"Context","textWithKeyword":"Given ett nytt API-spel med två spelare","stepMatchArguments":[]},{"pwStepLine":24,"gherkinStepLine":18,"keywordType":"Action","textWithKeyword":"When spelare 1 bygger TES och claimar ordet","stepMatchArguments":[]},{"pwStepLine":25,"gherkinStepLine":19,"keywordType":"Outcome","textWithKeyword":"Then inga fler bokstäver kan spelas under pending dispute","stepMatchArguments":[]},{"pwStepLine":26,"gherkinStepLine":20,"keywordType":"Outcome","textWithKeyword":"And claimaren får inte acceptera eller bestrida sitt eget claim","stepMatchArguments":[]}]},
  {"pwTestLine":29,"pickleLine":22,"tags":[],"steps":[{"pwStepLine":30,"gherkinStepLine":23,"keywordType":"Context","textWithKeyword":"Given ett nytt API-spel med två spelare","stepMatchArguments":[]},{"pwStepLine":31,"gherkinStepLine":24,"keywordType":"Action","textWithKeyword":"When spelare 1 bygger CAT och claimar ordet","stepMatchArguments":[]},{"pwStepLine":32,"gherkinStepLine":25,"keywordType":"Action","textWithKeyword":"And spelare 2 bestrider claimet","stepMatchArguments":[]},{"pwStepLine":33,"gherkinStepLine":26,"keywordType":"Outcome","textWithKeyword":"Then poängen följer regeln för giltigt ord vid dispute","stepMatchArguments":[]}]},
  {"pwTestLine":36,"pickleLine":28,"tags":[],"steps":[{"pwStepLine":37,"gherkinStepLine":29,"keywordType":"Context","textWithKeyword":"Given ett nytt API-spel med två spelare","stepMatchArguments":[]},{"pwStepLine":38,"gherkinStepLine":30,"keywordType":"Action","textWithKeyword":"When spelare 1 bygger TES och claimar ordet","stepMatchArguments":[]},{"pwStepLine":39,"gherkinStepLine":31,"keywordType":"Action","textWithKeyword":"And spelare 2 bestrider claimet","stepMatchArguments":[]},{"pwStepLine":40,"gherkinStepLine":32,"keywordType":"Outcome","textWithKeyword":"Then poängen följer regeln för ogiltigt ord vid dispute","stepMatchArguments":[]}]},
  {"pwTestLine":43,"pickleLine":34,"tags":[],"steps":[{"pwStepLine":44,"gherkinStepLine":35,"keywordType":"Context","textWithKeyword":"Given ett nytt API-spel med två spelare","stepMatchArguments":[]},{"pwStepLine":45,"gherkinStepLine":36,"keywordType":"Action","textWithKeyword":"When båda spelare förbrukar alla accepts och disputes","stepMatchArguments":[]},{"pwStepLine":46,"gherkinStepLine":37,"keywordType":"Outcome","textWithKeyword":"Then spelet är finished och har en vinnare eller oavgjort","stepMatchArguments":[]}]},
]; // bdd-data-end