Feature: Minimal UI flow

  Scenario: User can create game and play alternating turns
    Given I open the minimal demo app
    Then I see the app title "EverySecondLetter"
    When I create a game as "Alice"
    And another player "Bob" joins the same game via API
    Then the game status should be "InProgress"
    When I play letter "T"
    Then the current word should be "T"
    And the turn note should be "Waiting for the active player."
    When another player plays letter "E" via API
    And I refresh the game state
    Then the current word should be "TE"
    And the turn note should be "Your turn."
