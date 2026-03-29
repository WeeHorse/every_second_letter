using EverySecondLetter.Core.WordGame;
using EverySecondLetter.Games.EverySecondLetter;
using EverySecondLetter.Services;
using Xunit;

namespace EverySecondLetter.UnitTests;

public sealed class StartGameEngineTests
{
  [Fact]
  public void CreatePlan_Throws_WhenGameIsNotReadyToStart()
  {
    var sut = new StartGameEngine(new EverySecondLetterRules { MinimumPlayersToStart = 3, AutoStartWhenReady = false });
    var players = new List<GamePlayerState>
    {
      new(Guid.NewGuid(), "Player 1", 0, 0, 5, 5),
      new(Guid.NewGuid(), "Player 2", 1, 0, 5, 5)
    };

    var ex = Assert.Throws<ApiException>(() => sut.CreatePlan(GameStatus.WaitingForPlayers, players, players[0].PlayerId));

    Assert.Equal(409, ex.StatusCode);
    Assert.Contains("not ready to start", ex.Message, StringComparison.OrdinalIgnoreCase);
  }

  [Fact]
  public void CreatePlan_Throws_WhenStarterIsNotHost()
  {
    var sut = new StartGameEngine(new EverySecondLetterRules { MinimumPlayersToStart = 2, AutoStartWhenReady = false });
    var players = new List<GamePlayerState>
    {
      new(Guid.NewGuid(), "Player 1", 0, 0, 5, 5),
      new(Guid.NewGuid(), "Player 2", 1, 0, 5, 5)
    };

    var ex = Assert.Throws<ApiException>(() => sut.CreatePlan(GameStatus.WaitingForPlayers, players, players[1].PlayerId));

    Assert.Equal(403, ex.StatusCode);
    Assert.Contains("host", ex.Message, StringComparison.OrdinalIgnoreCase);
  }

  [Fact]
  public void CreatePlan_ReturnsFirstPlayerAsActive_WhenHostStartsReadyLobby()
  {
    var sut = new StartGameEngine(new EverySecondLetterRules { MinimumPlayersToStart = 2, AutoStartWhenReady = false });
    var players = new List<GamePlayerState>
    {
      new(Guid.NewGuid(), "Player 1", 0, 0, 5, 5),
      new(Guid.NewGuid(), "Player 2", 1, 0, 5, 5),
      new(Guid.NewGuid(), "Player 3", 2, 0, 5, 5)
    };

    var plan = sut.CreatePlan(GameStatus.WaitingForPlayers, players, players[0].PlayerId);

    Assert.Equal(players[0].PlayerId, plan.ActivePlayerId);
  }
}
