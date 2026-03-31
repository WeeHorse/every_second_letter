Feature: Gameplay UI flow

  Scenario: User can create a game and resolve an accepted claim
    Given I open the minimal demo app
    Then I see the app title "EverySecondLetter"
    And the gameplay rules document is available
    When I create a game as "Alice"
    And another player "Bob" joins the same game via API
    Then the game status should be "InProgress"
    When I play letter "T"
    And another player plays letter "E" via API
    And I refresh the game state
    And I play letter "S"
    When I claim the current word
    Then the game status should be "PendingDispute"
    And the pending claim word should be "TES"
    When the opponent accepts the pending claim via API
    And I refresh the game state
    Then the game status should be "InProgress"
    And the current word should be "—"
    And player "Alice" should have score 4
    And the turn note should be "Waiting for the active player."
