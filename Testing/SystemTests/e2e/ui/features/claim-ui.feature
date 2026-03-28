Feature: Claim button UI restriction

  Scenario: Opponent sees claim button disabled after your letter
    Given ett nytt spel där spelare 1 har lagt senaste bokstaven
    Then spelare 2 ser claim-knappen som inaktiverad

  Scenario: Last-letter player still sees claim disabled before minimum length
    Given ett nytt spel där spelare 1 har lagt senaste bokstaven
    Then spelare 1 ser claim-knappen som inaktiverad under minimiordlängd