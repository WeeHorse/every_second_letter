Feature: Gameplay and rules coverage

  Scenario: Wrong player cannot play out of turn
    Given ett nytt API-spel med två spelare
    Then spelare 2 nekas att lägga bokstav innan spelare 1 har spelat

  Scenario: Letter input must be exactly one valid letter
    Given ett nytt API-spel med två spelare
    Then ogiltiga bokstavsinmatningar nekas

  Scenario: Claim requires minimum three letters
    Given ett nytt API-spel med två spelare
    When spelare 1 och 2 bygger ordet till två bokstäver
    Then claim nekas på för kort ord

  Scenario: Pending dispute blocks further letter play and claimer cannot resolve
    Given ett nytt API-spel med två spelare
    When spelare 1 bygger TES och claimar ordet
    Then inga fler bokstäver kan spelas under pending dispute
    And claimaren får inte acceptera eller bestrida sitt eget claim

  Scenario: Disputing a valid word gives claimer 150 percent
    Given ett nytt API-spel med två spelare
    When spelare 1 bygger CAT och claimar ordet
    And spelare 2 bestrider claimet
    Then poängen följer regeln för giltigt ord vid dispute

  Scenario: Disputing an invalid word gives opponent 50 percent
    Given ett nytt API-spel med två spelare
    When spelare 1 bygger TES och claimar ordet
    And spelare 2 bestrider claimet
    Then poängen följer regeln för ogiltigt ord vid dispute

  Scenario: Game ends when both players exhaust accepts and disputes
    Given ett nytt API-spel med två spelare
    When båda spelare förbrukar alla accepts och disputes
    Then spelet är finished och har en vinnare eller oavgjort