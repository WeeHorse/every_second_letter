namespace EverySecondLetter.DTOs;

public sealed record WordHistoryEntry(
    string Word,
    Guid ClaimerId,
    int Player1Points,
    int Player2Points,
    bool IsValid
);
