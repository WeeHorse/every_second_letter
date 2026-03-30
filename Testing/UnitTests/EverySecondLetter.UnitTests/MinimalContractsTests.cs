using Xunit;

namespace EverySecondLetter.UnitTests;

public sealed class MinimalContractsTests
{
    [Fact]
    public void GameState_StartsEmptyByDefault()
    {
        var state = new GameState();

        Assert.Equal(string.Empty, state.CurrentWord);
        Assert.Empty(state.Players);
        Assert.Null(state.ActivePlayerId);
        Assert.Equal(GameStatus.WaitingForPlayers, state.Status);
    }

    [Fact]
    public void PlayLetterRequest_StoresLetterValue()
    {
        var request = new PlayLetterRequest("T");

        Assert.Equal("T", request.Letter);
    }
}
