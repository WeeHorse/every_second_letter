using System.Text.Json.Serialization;

namespace EverySecondLetter.Gameplay.EverySecondLetter;

public enum GameStatus
{
  WaitingForPlayers,
  InProgress,
  PendingDispute,
  Finished
}

public sealed record CreateGameResponse(Guid GameId, Guid PlayerToken);

public sealed record JoinGameResponse(Guid GameId, Guid PlayerToken);

public sealed record PlayLetterRequest(string Letter);

public sealed record ValidateWordRequest(
    [property: JsonPropertyName("word")]
    string Word
);

public sealed record GamePlayerState(
    Guid PlayerId,
    int TurnOrder,
    int Score,
    int AcceptsRemaining,
    int DisputesRemaining
);

public sealed record PlayerPoints(Guid PlayerId, int Points);

public sealed record WordHistoryEntry(
    string Word,
    Guid ClaimerId,
    List<PlayerPoints> PlayerPoints,
    bool IsValid,
    int Player1Points,
    int Player2Points
);

public sealed record GameStateDto(
    Guid GameId,
    GameStatus Status,
    string CurrentWord,
    Guid? ActivePlayerId,
    Guid? LastLetterPlayerId,
    List<GamePlayerState> Players,
    Guid? PendingClaimerId,
    string? PendingWord,
    List<WordHistoryEntry> WordHistory
)
{
  public Guid Player1Id => Players.Count > 0 ? Players[0].PlayerId : Guid.Empty;
  public Guid? Player2Id => Players.Count > 1 ? Players[1].PlayerId : null;
  public int Player1Score => Players.Count > 0 ? Players[0].Score : 0;
  public int Player2Score => Players.Count > 1 ? Players[1].Score : 0;
  public int Player1Accepts => Players.Count > 0 ? Players[0].AcceptsRemaining : 0;
  public int Player1Disputes => Players.Count > 0 ? Players[0].DisputesRemaining : 0;
  public int Player2Accepts => Players.Count > 1 ? Players[1].AcceptsRemaining : 0;
  public int Player2Disputes => Players.Count > 1 ? Players[1].DisputesRemaining : 0;
}