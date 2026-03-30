using Xunit;

namespace EverySecondLetter.UnitTests;

public sealed class TurnRulesTests
{
  [Fact]
  public void GetNextPlayerId_ReturnsNextPlayer_WhenCurrentIsFirst()
  {
    var playerOne = new Player(Guid.NewGuid(), "Alice", 0);
    var playerTwo = new Player(Guid.NewGuid(), "Bob", 1);

    var next = TurnRules.GetNextPlayerId(new[] { playerOne, playerTwo }, playerOne.PlayerId);

    Assert.Equal(playerTwo.PlayerId, next);
  }

  [Fact]
  public void GetNextPlayerId_WrapsAround_WhenCurrentIsLast()
  {
    var playerOne = new Player(Guid.NewGuid(), "Alice", 0);
    var playerTwo = new Player(Guid.NewGuid(), "Bob", 1);

    var next = TurnRules.GetNextPlayerId(new[] { playerOne, playerTwo }, playerTwo.PlayerId);

    Assert.Equal(playerOne.PlayerId, next);
  }

  [Fact]
  public void GetNextPlayerId_Throws_WhenCurrentPlayerDoesNotExist()
  {
    var players = new[]
    {
            new Player(Guid.NewGuid(), "Alice", 0),
            new Player(Guid.NewGuid(), "Bob", 1),
        };

    Assert.Throws<ArgumentException>(() => TurnRules.GetNextPlayerId(players, Guid.NewGuid()));
  }
}
