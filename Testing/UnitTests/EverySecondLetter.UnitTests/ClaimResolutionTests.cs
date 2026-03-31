using Xunit;

namespace EverySecondLetter.UnitTests;

public sealed class ClaimResolutionTests
{
  [Fact]
  public void ApplyAcceptedClaim_AwardsBaseScoreAndResetsRound()
  {
    var (state, playerOne, playerTwo) = CreateState(
        "TES",
        [
            new LetterPlay(Guid.Empty, 'T'),
                new LetterPlay(Guid.Empty, 'E'),
                new LetterPlay(Guid.Empty, 'S'),
        ]);

    state.CurrentLetters[0] = new LetterPlay(playerOne.PlayerId, 'T');
    state.CurrentLetters[1] = new LetterPlay(playerTwo.PlayerId, 'E');
    state.CurrentLetters[2] = new LetterPlay(playerOne.PlayerId, 'S');
    state.LastLetterPlayerId = playerOne.PlayerId;
    state.ActivePlayerId = playerTwo.PlayerId;

    var pendingClaim = GameRules.CreatePendingClaim(state, playerOne.PlayerId);
    state.PendingClaim = pendingClaim;
    state.Status = GameStatus.PendingDispute;

    var resolution = GameRules.ApplyAcceptedClaim(state, pendingClaim);

    Assert.Equal(ClaimOutcome.Accepted, resolution.Outcome);
    Assert.Equal(4, resolution.ClaimerScoreAwarded);
    Assert.Equal(0, resolution.ResponderScoreAwarded);
    Assert.Equal(4, playerOne.Score);
    Assert.Equal(0, playerTwo.Score);
    Assert.Equal(4, playerTwo.AcceptsRemaining);
    Assert.Equal(GameStatus.InProgress, state.Status);
    Assert.Equal(string.Empty, state.CurrentWord);
    Assert.Empty(state.CurrentLetters);
    Assert.Null(state.PendingClaim);
    Assert.Equal(playerTwo.PlayerId, state.ActivePlayerId);
  }

  [Fact]
  public void ApplyDisputedClaim_OnValidWord_AwardsBonusToClaimer()
  {
    var (state, playerOne, playerTwo) = CreateState(
        "TEST",
        [
            new LetterPlay(Guid.Empty, 'T'),
                new LetterPlay(Guid.Empty, 'E'),
                new LetterPlay(Guid.Empty, 'S'),
                new LetterPlay(Guid.Empty, 'T'),
        ]);

    state.CurrentLetters[0] = new LetterPlay(playerOne.PlayerId, 'T');
    state.CurrentLetters[1] = new LetterPlay(playerTwo.PlayerId, 'E');
    state.CurrentLetters[2] = new LetterPlay(playerOne.PlayerId, 'S');
    state.CurrentLetters[3] = new LetterPlay(playerTwo.PlayerId, 'T');
    state.LastLetterPlayerId = playerTwo.PlayerId;
    state.ActivePlayerId = playerOne.PlayerId;

    var pendingClaim = GameRules.CreatePendingClaim(state, playerTwo.PlayerId);
    state.PendingClaim = pendingClaim;
    state.Status = GameStatus.PendingDispute;

    var resolution = GameRules.ApplyDisputedClaim(state, pendingClaim, isWordValid: true);

    Assert.Equal(ClaimOutcome.ValidAfterDispute, resolution.Outcome);
    Assert.Equal(6, resolution.ClaimerScoreAwarded);
    Assert.Equal(0, resolution.ResponderScoreAwarded);
    Assert.Equal(0, playerOne.Score);
    Assert.Equal(6, playerTwo.Score);
    Assert.Equal(4, playerOne.DisputesRemaining);
    Assert.Equal(GameStatus.InProgress, state.Status);
    Assert.Equal(playerOne.PlayerId, state.ActivePlayerId);
    Assert.Null(state.PendingClaim);
  }

  [Fact]
  public void ApplyDisputedClaim_OnInvalidWord_AwardsPenaltyScoreToResponder()
  {
    var (state, playerOne, playerTwo) = CreateState(
        "QZX",
        [
            new LetterPlay(Guid.Empty, 'Q'),
                new LetterPlay(Guid.Empty, 'Z'),
                new LetterPlay(Guid.Empty, 'X'),
        ]);

    state.CurrentLetters[0] = new LetterPlay(playerOne.PlayerId, 'Q');
    state.CurrentLetters[1] = new LetterPlay(playerTwo.PlayerId, 'Z');
    state.CurrentLetters[2] = new LetterPlay(playerOne.PlayerId, 'X');
    state.LastLetterPlayerId = playerOne.PlayerId;
    state.ActivePlayerId = playerTwo.PlayerId;

    var pendingClaim = GameRules.CreatePendingClaim(state, playerOne.PlayerId);
    state.PendingClaim = pendingClaim;
    state.Status = GameStatus.PendingDispute;

    var resolution = GameRules.ApplyDisputedClaim(state, pendingClaim, isWordValid: false);

    Assert.Equal(ClaimOutcome.InvalidAfterDispute, resolution.Outcome);
    Assert.Equal(0, resolution.ClaimerScoreAwarded);
    Assert.Equal(2, resolution.ResponderScoreAwarded);
    Assert.Equal(0, playerOne.Score);
    Assert.Equal(2, playerTwo.Score);
    Assert.Equal(4, playerTwo.DisputesRemaining);
    Assert.Equal(GameStatus.InProgress, state.Status);
    Assert.Equal(playerTwo.PlayerId, state.ActivePlayerId);
    Assert.Equal(string.Empty, state.CurrentWord);
  }

  [Fact]
  public void ApplyAcceptedClaim_FinishesGameAndSelectsWinner_WhenActionsAreExhausted()
  {
    var (state, playerOne, playerTwo) = CreateState(
        "TES",
        [
            new LetterPlay(Guid.Empty, 'T'),
                new LetterPlay(Guid.Empty, 'E'),
                new LetterPlay(Guid.Empty, 'S'),
        ]);

    state.CurrentLetters[0] = new LetterPlay(playerOne.PlayerId, 'T');
    state.CurrentLetters[1] = new LetterPlay(playerTwo.PlayerId, 'E');
    state.CurrentLetters[2] = new LetterPlay(playerOne.PlayerId, 'S');
    state.LastLetterPlayerId = playerOne.PlayerId;
    state.ActivePlayerId = playerTwo.PlayerId;

    playerOne.Score = 6;
    playerOne.AcceptsRemaining = 0;
    playerOne.DisputesRemaining = 0;
    playerTwo.Score = 1;
    playerTwo.AcceptsRemaining = 1;
    playerTwo.DisputesRemaining = 0;

    var pendingClaim = GameRules.CreatePendingClaim(state, playerOne.PlayerId);
    state.PendingClaim = pendingClaim;
    state.Status = GameStatus.PendingDispute;

    GameRules.ApplyAcceptedClaim(state, pendingClaim);

    Assert.Equal(GameStatus.Finished, state.Status);
    Assert.Equal(playerOne.PlayerId, state.WinnerPlayerId);
    Assert.Equal("Alice wins with 10 points.", state.WinnerSummary);
    Assert.Equal(10, playerOne.Score);
    Assert.Equal(0, playerTwo.AcceptsRemaining);
  }

  private static (GameState State, Player PlayerOne, Player PlayerTwo) CreateState(string word, List<LetterPlay> letters)
  {
    var playerOne = new Player(Guid.NewGuid(), "Alice", 0);
    var playerTwo = new Player(Guid.NewGuid(), "Bob", 1);
    var state = new GameState
    {
      GameId = Guid.NewGuid(),
      Status = GameStatus.InProgress,
      CurrentWord = word,
      Players = [playerOne, playerTwo],
      CurrentLetters = letters,
    };

    return (state, playerOne, playerTwo);
  }
}