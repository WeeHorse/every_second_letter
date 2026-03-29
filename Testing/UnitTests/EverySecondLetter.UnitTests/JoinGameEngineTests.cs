using EverySecondLetter.Core.WordGame;
using EverySecondLetter.Games.EverySecondLetter;
using EverySecondLetter.Services;
using Xunit;

namespace EverySecondLetter.UnitTests;

public sealed class JoinGameEngineTests
{
  private readonly JoinGameEngine _sut = new(new EverySecondLetterRules());

  [Fact]
  public void CreatePlan_ReturnsRejoin_WhenExistingTokenAlreadyBelongsToPlayer()
  {
    var existingPlayerId = Guid.NewGuid();
    var players = new List<GamePlayerState>
        {
            new(existingPlayerId, "Player 1", 0, 0, 5, 5)
        };

    var plan = _sut.CreatePlan(GameStatus.WaitingForPlayers, players, Guid.NewGuid(), existingPlayerId);

    Assert.True(plan.IsRejoin);
    Assert.Equal(existingPlayerId, plan.ResultPlayerId);
    Assert.Null(plan.TurnOrder);
    Assert.False(plan.ShouldStart);
    Assert.Null(plan.ActivePlayerId);
  }

  [Fact]
  public void CreatePlan_Throws_WhenGameIsNotJoinable()
  {
    var players = new List<GamePlayerState>
        {
            new(Guid.NewGuid(), "Player 1", 0, 0, 5, 5),
            new(Guid.NewGuid(), "Player 2", 1, 0, 5, 5)
        };

    var ex = Assert.Throws<ApiException>(() => _sut.CreatePlan(GameStatus.InProgress, players, Guid.NewGuid()));

    Assert.Equal(409, ex.StatusCode);
    Assert.Contains("not joinable", ex.Message, StringComparison.OrdinalIgnoreCase);
  }

  [Fact]
  public void CreatePlan_ForSecondPlayer_StartsGame_AndSetsFirstPlayerActive()
  {
    var player1 = new GamePlayerState(Guid.NewGuid(), "Player 1", 0, 0, 5, 5);
    var players = new List<GamePlayerState> { player1 };
    var joiningPlayerId = Guid.NewGuid();

    var plan = _sut.CreatePlan(GameStatus.WaitingForPlayers, players, joiningPlayerId);

    Assert.False(plan.IsRejoin);
    Assert.Equal(joiningPlayerId, plan.ResultPlayerId);
    Assert.Equal(1, plan.TurnOrder);
    Assert.True(plan.ShouldStart);
    Assert.Equal(player1.PlayerId, plan.ActivePlayerId);
  }

  [Fact]
  public void CreatePlan_ForFirstPlayerJoinWithoutEnoughPlayers_DoesNotStartGame()
  {
    var definition = new EverySecondLetterRules { MinimumPlayersToStart = 3 };
    var sut = new JoinGameEngine(definition);
    var player1 = new GamePlayerState(Guid.NewGuid(), "Player 1", 0, 0, 5, 5);
    var players = new List<GamePlayerState> { player1 };

    var plan = sut.CreatePlan(GameStatus.WaitingForPlayers, players, Guid.NewGuid());

    Assert.False(plan.IsRejoin);
    Assert.Equal(1, plan.TurnOrder);
    Assert.False(plan.ShouldStart);
    Assert.Null(plan.ActivePlayerId);
  }

  [Fact]
  public void CreatePlan_WhenAutoStartIsDisabled_KeepsGameWaitingEvenWhenEnoughPlayersHaveJoined()
  {
    var rules = new EverySecondLetterRules
    {
      MinimumPlayersToStart = 2,
      AutoStartWhenReady = false
    };
    var sut = new JoinGameEngine(rules);
    var player1 = new GamePlayerState(Guid.NewGuid(), "Player 1", 0, 0, 5, 5);
    var players = new List<GamePlayerState> { player1 };

    var plan = sut.CreatePlan(GameStatus.WaitingForPlayers, players, Guid.NewGuid());

    Assert.False(plan.IsRejoin);
    Assert.Equal(1, plan.TurnOrder);
    Assert.False(plan.ShouldStart);
    Assert.Null(plan.ActivePlayerId);
  }
}