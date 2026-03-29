using EverySecondLetter.Core.WordGame;

namespace EverySecondLetter.Games.EverySecondLetter;

public sealed class EverySecondLetterRules : WordGameRules
{
    public EverySecondLetterRules()
    {
        // Concrete game defaults live here; the core engine remains generic.
        MinimumPlayersToStart = 2;
        MinimumClaimLength = 3;
        InitialAccepts = 5;
        InitialDisputes = 5;
        AutoStartWhenReady = true;
        AllowedLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ";
        MaximumPlayers = null;
    }
}
