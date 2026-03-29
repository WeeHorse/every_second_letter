using EverySecondLetter.Core.WordGame;
using EverySecondLetter.Games.EverySecondLetter;
using EverySecondLetter.Services;
using Xunit;

namespace EverySecondLetter.UnitTests;

public sealed class EverySecondLetterRulesTests
{
  private readonly EverySecondLetterRules _sut = new();

  [Theory]
  [InlineData(GameStatus.WaitingForPlayers, 0, true)]
  [InlineData(GameStatus.WaitingForPlayers, 1, true)]
  [InlineData(GameStatus.WaitingForPlayers, 2, true)]
  [InlineData(GameStatus.InProgress, 1, false)]
  [InlineData(GameStatus.PendingDispute, 1, false)]
  [InlineData(GameStatus.Finished, 1, false)]
  public void CanJoin_ReturnsExpectedValue(GameStatus status, int currentPlayerCount, bool expected)
  {
    var result = _sut.CanJoin(status, currentPlayerCount);

    Assert.Equal(expected, result);
  }

  [Theory]
  [InlineData(1, false)]
  [InlineData(2, true)]
  [InlineData(3, true)]
  public void ShouldStart_ReturnsExpectedValue(int playerCount, bool expected)
  {
    var result = _sut.ShouldStart(playerCount);

    Assert.Equal(expected, result);
  }

  [Theory]
  [InlineData(GameStatus.WaitingForPlayers, 1, false)]
  [InlineData(GameStatus.WaitingForPlayers, 2, true)]
  [InlineData(GameStatus.InProgress, 2, false)]
  public void CanStart_ReturnsExpectedValue(GameStatus status, int playerCount, bool expected)
  {
    var result = _sut.CanStart(status, playerCount);

    Assert.Equal(expected, result);
  }

  [Theory]
  [InlineData("abc", true)]
  [InlineData("ab", false)]
  [InlineData("", false)]
  public void CanClaim_RequiresMinimumLengthAndMatchingLastPlayer(string currentWord, bool expected)
  {
    var playerId = Guid.NewGuid();

    var result = _sut.CanClaim(currentWord, playerId, playerId);

    Assert.Equal(expected, result);
  }

  [Fact]
  public void CanClaim_ReturnsFalse_WhenLastLetterPlayerIsMissing()
  {
    var result = _sut.CanClaim("CAT", null, Guid.NewGuid());

    Assert.False(result);
  }

  [Fact]
  public void CanClaim_ReturnsFalse_WhenClaimingPlayerDidNotPlaceLastLetter()
  {
    var result = _sut.CanClaim("CAT", Guid.NewGuid(), Guid.NewGuid());

    Assert.False(result);
  }

  [Theory]
  [InlineData("a", "A")]
  [InlineData(" z ", "Z")]
  [InlineData("å", "Å")]
  [InlineData("ä", "Ä")]
  [InlineData("ö", "Ö")]
  public void NormalizeLetter_NormalizesValidLetters(string input, string expected)
  {
    var result = _sut.NormalizeLetter(input);

    Assert.Equal(expected, result);
  }

  [Theory]
  [InlineData("")]
  [InlineData(" ")]
  [InlineData(null)]
  public void NormalizeLetter_ThrowsForMissingInput(string? input)
  {
    var ex = Assert.Throws<ApiException>(() => _sut.NormalizeLetter(input!));

    Assert.Equal(400, ex.StatusCode);
    Assert.Contains("required", ex.Message, StringComparison.OrdinalIgnoreCase);
  }

  [Theory]
  [InlineData("AB")]
  [InlineData("cat")]
  public void NormalizeLetter_ThrowsForMultipleCharacters(string input)
  {
    var ex = Assert.Throws<ApiException>(() => _sut.NormalizeLetter(input));

    Assert.Equal(400, ex.StatusCode);
    Assert.Contains("exactly one character", ex.Message, StringComparison.OrdinalIgnoreCase);
  }

  [Theory]
  [InlineData("1")]
  [InlineData("-")]
  [InlineData("?")]
  public void NormalizeLetter_ThrowsForInvalidCharacters(string input)
  {
    var ex = Assert.Throws<ApiException>(() => _sut.NormalizeLetter(input));

    Assert.Equal(400, ex.StatusCode);
    Assert.Contains("A-Z", ex.Message, StringComparison.OrdinalIgnoreCase);
  }

  [Fact]
  public void GetNextPlayerId_RotatesToNextPlayer()
  {
    var player1 = new GamePlayerState(Guid.NewGuid(), "P1", 0, 0, 5, 5);
    var player2 = new GamePlayerState(Guid.NewGuid(), "P2", 1, 0, 5, 5);
    var players = new[] { player1, player2 };

    var result = _sut.GetNextPlayerId(players, player1.PlayerId);

    Assert.Equal(player2.PlayerId, result);
  }

  [Fact]
  public void GetNextPlayerId_WrapsAroundToFirstPlayer()
  {
    var player1 = new GamePlayerState(Guid.NewGuid(), "P1", 0, 0, 5, 5);
    var player2 = new GamePlayerState(Guid.NewGuid(), "P2", 1, 0, 5, 5);
    var players = new[] { player1, player2 };

    var result = _sut.GetNextPlayerId(players, player2.PlayerId);

    Assert.Equal(player1.PlayerId, result);
  }

  [Fact]
  public void GetNextPlayerId_ThrowsForEmptyPlayerList()
  {
    var ex = Assert.Throws<InvalidOperationException>(() => _sut.GetNextPlayerId(Array.Empty<GamePlayerState>(), Guid.NewGuid()));

    Assert.Contains("empty player list", ex.Message, StringComparison.OrdinalIgnoreCase);
  }

  [Fact]
  public void GetNextPlayerId_ThrowsWhenCurrentPlayerIsNotInGame()
  {
    var players = new[]
    {
            new GamePlayerState(Guid.NewGuid(), "P1", 0, 0, 5, 5),
            new GamePlayerState(Guid.NewGuid(), "P2", 1, 0, 5, 5)
        };

    var ex = Assert.Throws<ApiException>(() => _sut.GetNextPlayerId(players, Guid.NewGuid()));

    Assert.Equal(409, ex.StatusCode);
    Assert.Contains("not part of this game", ex.Message, StringComparison.OrdinalIgnoreCase);
  }

  [Theory]
  [InlineData(0, 0)]
  [InlineData(1, 1)]
  [InlineData(2, 4)]
  [InlineData(3, 9)]
  public void GetBaseScore_SquaresContributionCount(int contributionCount, int expected)
  {
    var result = _sut.GetBaseScore(contributionCount);

    Assert.Equal(expected, result);
  }

  [Theory]
  [InlineData(4, 4)]
  [InlineData(9, 9)]
  public void GetAcceptedScore_ReturnsBaseScore(int baseScore, int expected)
  {
    var result = _sut.GetAcceptedScore(baseScore);

    Assert.Equal(expected, result);
  }

  [Theory]
  [InlineData(1, 1)]
  [InlineData(4, 6)]
  [InlineData(9, 13)]
  public void GetValidDisputedScore_ReturnsOneAndHalfTimesBaseScoreRoundedDown(int baseScore, int expected)
  {
    var result = _sut.GetValidDisputedScore(baseScore);

    Assert.Equal(expected, result);
  }

  [Theory]
  [InlineData(1, 0)]
  [InlineData(4, 2)]
  [InlineData(9, 4)]
  public void GetInvalidDisputedScore_ReturnsHalfBaseScoreRoundedDown(int baseScore, int expected)
  {
    var result = _sut.GetInvalidDisputedScore(baseScore);

    Assert.Equal(expected, result);
  }
}
