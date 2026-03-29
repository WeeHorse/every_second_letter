using EverySecondLetter.Core.WordGame;
using Xunit;

namespace EverySecondLetter.UnitTests;

public sealed class GameStateDtoTests
{
  [Fact]
  public void Constructor_StoresPlayersList_AsProvided()
  {
    var player1 = new GamePlayerState(Guid.NewGuid(), "Player 1", 0, 12, 4, 3);
    var player2 = new GamePlayerState(Guid.NewGuid(), "Player 2", 1, 7, 2, 1);

    var sut = new GameStateDto(
        Guid.NewGuid(),
        GameStatus.InProgress,
        "CAT",
        player1.PlayerId,
        player2.PlayerId,
        new List<GamePlayerState> { player1, player2 },
        null,
        null,
        new List<WordHistoryEntry>());

    Assert.Equal(2, sut.Players.Count);
    Assert.Equal(player1.PlayerId, sut.Players[0].PlayerId);
    Assert.Equal(player2.PlayerId, sut.Players[1].PlayerId);
    Assert.Equal(12, sut.Players[0].Score);
    Assert.Equal(7, sut.Players[1].Score);
    Assert.Equal(4, sut.Players[0].AcceptsRemaining);
    Assert.Equal(1, sut.Players[1].DisputesRemaining);
  }

  [Fact]
  public void WordHistoryEntry_UsesGenericPointEntries_WithoutLegacyPlayerColumns()
  {
    var claimerId = Guid.NewGuid();
    var pointEntries = new List<PlayerPoints>
    {
      new(Guid.NewGuid(), 6),
      new(Guid.NewGuid(), -2)
    };

    var entry = new WordHistoryEntry("TEST", claimerId, pointEntries, IsValid: true);

    Assert.Equal("TEST", entry.Word);
    Assert.Equal(claimerId, entry.ClaimerId);
    Assert.True(entry.IsValid);
    Assert.Equal(2, entry.PlayerPoints.Count);
    Assert.Equal(6, entry.PlayerPoints[0].Points);
    Assert.Equal(-2, entry.PlayerPoints[1].Points);
  }
}
