using EverySecondLetter.Services;

namespace EverySecondLetter.DTOs;

public sealed record GameStateDto(
    Guid GameId,
    GameStatus Status,
    string CurrentWord,
    Guid ActivePlayerId,
    Guid? LastLetterPlayerId,
    Guid Player1Id,
    Guid? Player2Id,
    int Player1Score,
    int Player2Score,
    int Player1Accepts,
    int Player1Disputes,
    int Player2Accepts,
    int Player2Disputes,
    Guid? PendingClaimerId,
    string? PendingWord,
    List<WordHistoryEntry> WordHistory
);