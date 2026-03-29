using System.Text.Json.Serialization;

namespace EverySecondLetter.Core.WordGame;

public enum GameStatus
{
    WaitingForPlayers,
    InProgress,
    PendingDispute,
    Finished
}

public sealed record CreateGameResponse(Guid GameId, Guid PlayerToken);

public sealed record JoinGameResponse(Guid GameId, Guid PlayerToken);

public sealed record PlayerRegistrationRequest(string? PlayerName);

public sealed record PlayLetterRequest(string Letter);

public sealed record ValidateWordRequest(
    [property: JsonPropertyName("word")]
    string Word
);

public sealed record GamePlayerState(
    Guid PlayerId,
    string PlayerName,
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
    bool IsValid
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
);
