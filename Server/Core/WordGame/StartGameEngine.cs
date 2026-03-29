using EverySecondLetter.Services;

namespace EverySecondLetter.Core.WordGame;

public sealed record StartGamePlan(Guid ActivePlayerId);

public sealed class StartGameEngine
{
    private readonly WordGameRules _rules;

    public StartGameEngine(WordGameRules rules)
    {
        _rules = rules;
    }

    public StartGamePlan CreatePlan(
        GameStatus status,
        IReadOnlyList<GamePlayerState> players,
        Guid playerToken)
    {
        EnsurePlayerInGame(players, playerToken);

        if (!_rules.CanStart(status, players.Count))
            throw new ApiException(409, "Game is not ready to start.");

        var hostPlayerId = players.FirstOrDefault()?.PlayerId
            ?? throw new ApiException(409, "Cannot start a game without players.");

        if (playerToken != hostPlayerId)
            throw new ApiException(403, "Only the host may start the game.");

        return new StartGamePlan(hostPlayerId);
    }

    private static void EnsurePlayerInGame(IReadOnlyList<GamePlayerState> players, Guid playerToken)
    {
        if (players.All(player => player.PlayerId != playerToken))
            throw new ApiException(401, "Player token is not part of this game.");
    }
}
