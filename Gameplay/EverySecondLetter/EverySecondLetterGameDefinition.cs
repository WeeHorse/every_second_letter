namespace EverySecondLetter.Gameplay.EverySecondLetter;

public sealed class EverySecondLetterGameDefinition
{
  public int MinimumPlayersToStart { get; init; } = 2;
  public int MinimumClaimLength { get; init; } = 3;
  public int InitialAccepts { get; init; } = 5;
  public int InitialDisputes { get; init; } = 5;
  public int? MaximumPlayers { get; init; }

  public bool CanJoin(GameStatus status, int currentPlayerCount)
  {
    return status == GameStatus.WaitingForPlayers
        && (!MaximumPlayers.HasValue || currentPlayerCount < MaximumPlayers.Value);
  }

  public bool ShouldStart(int playerCount)
  {
    return playerCount >= MinimumPlayersToStart;
  }

  public bool CanClaim(string currentWord, Guid? lastLetterPlayerId, Guid playerId)
  {
    return !string.IsNullOrWhiteSpace(currentWord)
        && currentWord.Length >= MinimumClaimLength
        && lastLetterPlayerId.HasValue
        && lastLetterPlayerId.Value == playerId;
  }

  public string NormalizeLetter(string input)
  {
    if (string.IsNullOrWhiteSpace(input))
      throw new Services.ApiException(400, "Letter is required.");

    var trimmed = input.Trim();
    if (trimmed.Length != 1)
      throw new Services.ApiException(400, "Letter must be exactly one character.");

    var value = char.ToUpperInvariant(trimmed[0]);
    const string allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ";
    if (!allowed.Contains(value))
      throw new Services.ApiException(400, "Letter must be A-Z (optionally ÅÄÖ).");

    return value.ToString();
  }

  public Guid GetNextPlayerId(IReadOnlyList<GamePlayerState> players, Guid currentPlayerId)
  {
    if (players.Count == 0)
      throw new InvalidOperationException("Cannot rotate an empty player list.");

    var currentIndex = players
        .Select((player, index) => new { player.PlayerId, Index = index })
        .FirstOrDefault(x => x.PlayerId == currentPlayerId)?.Index;

    if (currentIndex is null)
      throw new Services.ApiException(409, "Active player is not part of this game.");

    return players[(currentIndex.Value + 1) % players.Count].PlayerId;
  }

  public int GetBaseScore(int contributionCount)
  {
    return contributionCount * contributionCount;
  }

  public int GetAcceptedScore(int baseScore)
  {
    return baseScore;
  }

  public int GetValidDisputedScore(int baseScore)
  {
    return (int)Math.Floor(baseScore * 1.5);
  }

  public int GetInvalidDisputedScore(int baseScore)
  {
    return (int)Math.Floor(baseScore * 0.5);
  }
}