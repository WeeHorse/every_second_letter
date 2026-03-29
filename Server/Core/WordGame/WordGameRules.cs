using EverySecondLetter.Services;

namespace EverySecondLetter.Core.WordGame;

public class WordGameRules
{
    public int MinimumPlayersToStart { get; set; } = 2;
    public int MinimumClaimLength { get; set; } = 3;
    public int InitialAccepts { get; set; } = 5;
    public int InitialDisputes { get; set; } = 5;
    public int? MaximumPlayers { get; set; }
    public bool AutoStartWhenReady { get; set; } = true;
    public string AllowedLetters { get; set; } = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ";

    public bool CanJoin(GameStatus status, int currentPlayerCount)
    {
        return status == GameStatus.WaitingForPlayers
            && (!MaximumPlayers.HasValue || currentPlayerCount < MaximumPlayers.Value);
    }

    public bool ShouldStart(int playerCount)
    {
        return AutoStartWhenReady && playerCount >= MinimumPlayersToStart;
    }

    public bool CanStart(GameStatus status, int playerCount)
    {
        return status == GameStatus.WaitingForPlayers && playerCount >= MinimumPlayersToStart;
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
            throw new ApiException(400, "Letter is required.");

        var trimmed = input.Trim();
        if (trimmed.Length != 1)
            throw new ApiException(400, "Letter must be exactly one character.");

        var value = char.ToUpperInvariant(trimmed[0]);
        if (!AllowedLetters.Contains(value))
            throw new ApiException(400, "Letter must be A-Z (optionally ÅÄÖ).");

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
            throw new ApiException(409, "Active player is not part of this game.");

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
