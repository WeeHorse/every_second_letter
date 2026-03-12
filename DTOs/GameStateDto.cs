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
    Guid? PendingClaimerId,
    string? PendingWord,
    List<WordHistoryEntry> WordHistory
);