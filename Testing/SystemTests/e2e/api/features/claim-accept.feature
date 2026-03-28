Feature: Claim and accept flow

  Scenario: Claim followed by accept returns stable game state
    Given ett nytt spel med två spelare via API
    When spelare 1 bygger ordet TES och claimar
    Then spelare 2 accepterar utan serverfel och spelet återställs

  Scenario: Opponent cannot claim your latest letter
    Given ett nytt spel med två spelare via API
    When spelare 1 lägger en bokstav
    Then spelare 2 kan inte claima ordet