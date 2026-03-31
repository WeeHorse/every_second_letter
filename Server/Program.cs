using System.Collections.Concurrent;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var dictionaryPath = Path.Combine(builder.Environment.ContentRootPath, "Data", "enable1.txt");
var dictionary = await WordDictionary.LoadFromFileAsync(dictionaryPath);

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

var games = new ConcurrentDictionary<Guid, GameState>();

// POST /games?playerName=Alice
// Catch-all for SPA routing: serve index.html for non-API routes
app.MapFallbackToFile("index.html");

app.MapPost("/games", (string playerName = "Player") =>
{
    var gameId = Guid.NewGuid();
    var playerId = Guid.NewGuid();
    var state = new GameState
    {
        GameId = gameId,
        Players = new List<Player> { new(playerId, playerName, TurnOrder: 0) },
        CurrentWord = "",
        ActivePlayerId = playerId,
        Status = GameStatus.WaitingForPlayers
    };
    games[gameId] = state;
    return Results.Created($"/games/{gameId}",
        new { gameId, playerId });
});

// POST /games/{gameId}/join?playerName=Bob
app.MapPost("/games/{gameId:guid}/join", (Guid gameId, string playerName = "Player") =>
{
    if (!games.TryGetValue(gameId, out var state))
        return Results.NotFound();

    if (state.Status != GameStatus.WaitingForPlayers)
        return Results.BadRequest("Game already started");

    if (state.Players.Count >= 2)
        return Results.BadRequest("Game already has two players");

    var playerId = Guid.NewGuid();
    state.Players.Add(new(playerId, playerName, TurnOrder: state.Players.Count));

    if (state.Players.Count == 2)
        state.Status = GameStatus.InProgress;

    return Results.Ok(new { gameId, playerId });
});

// GET /games/{gameId}
app.MapGet("/games/{gameId:guid}", (Guid gameId) =>
{
    if (!games.TryGetValue(gameId, out var state))
        return Results.NotFound();
    return Results.Ok(state);
});

// POST /games/{gameId}/letter (header: X-Player-Token)
app.MapPost("/games/{gameId:guid}/letter",
    (Guid gameId, PlayLetterRequest req, HttpContext ctx) =>
{
    var playerId = GetPlayerId(ctx);
    if (playerId == null)
        return Results.BadRequest("Missing X-Player-Token header");

    if (!games.TryGetValue(gameId, out var state))
        return Results.NotFound();

    if (state.Status != GameStatus.InProgress)
        return Results.BadRequest("Game not in progress");

    if (!TryGetPlayer(state, playerId.Value, out _))
        return Results.BadRequest("Player is not part of this game");

    if (state.ActivePlayerId != playerId)
        return Results.BadRequest("Not your turn");

    var normalizedLetter = NormalizeLetter(req.Letter);
    if (normalizedLetter == null)
        return Results.BadRequest("Invalid letter");

    state.CurrentWord += normalizedLetter;
    state.CurrentLetters.Add(new LetterPlay(playerId.Value, normalizedLetter.Value));
    state.LastLetterPlayerId = playerId.Value;

    state.ActivePlayerId = TurnRules.GetNextPlayerId(state.Players, playerId.Value);

    return Results.Ok(state);
});

app.MapPost("/games/{gameId:guid}/claim", (Guid gameId, HttpContext ctx) =>
{
    var playerId = GetPlayerId(ctx);
    if (playerId == null)
        return Results.BadRequest("Missing X-Player-Token header");

    if (!games.TryGetValue(gameId, out var state))
        return Results.NotFound();

    if (state.Status != GameStatus.InProgress)
        return Results.BadRequest("Game not in progress");

    if (!TryGetPlayer(state, playerId.Value, out var player))
        return Results.BadRequest("Player is not part of this game");

    if (state.CurrentWord.Length < 3)
        return Results.BadRequest("Current word must be at least 3 letters long to claim");

    var canClaim = state.ActivePlayerId == playerId || state.LastLetterPlayerId == playerId;
    if (!canClaim)
        return Results.BadRequest("You can only claim on your turn or immediately after placing your latest letter");

    state.PendingClaim = GameRules.CreatePendingClaim(state, playerId.Value);
    state.Status = GameStatus.PendingDispute;
    state.ActivePlayerId = state.PendingClaim.ResponderId;

    var responder = state.Players.Single(current => current.PlayerId == state.PendingClaim.ResponderId);
    state.LastResolutionSummary = $"{player!.PlayerName} claimed {state.CurrentWord}. {responder.PlayerName} must accept or dispute.";

    return Results.Ok(state);
});

app.MapPost("/games/{gameId:guid}/accept", (Guid gameId, HttpContext ctx) =>
{
    var playerId = GetPlayerId(ctx);
    if (playerId == null)
        return Results.BadRequest("Missing X-Player-Token header");

    if (!games.TryGetValue(gameId, out var state))
        return Results.NotFound();

    if (state.Status != GameStatus.PendingDispute || state.PendingClaim == null)
        return Results.BadRequest("There is no pending claim to accept");

    if (state.PendingClaim.ResponderId != playerId)
        return Results.BadRequest("Only the opponent may accept this claim");

    var responder = state.Players.Single(player => player.PlayerId == playerId.Value);
    if (responder.AcceptsRemaining <= 0)
        return Results.BadRequest("No accepts remaining");

    GameRules.ApplyAcceptedClaim(state, state.PendingClaim);

    return Results.Ok(state);
});

app.MapPost("/games/{gameId:guid}/dispute", (Guid gameId, HttpContext ctx) =>
{
    var playerId = GetPlayerId(ctx);
    if (playerId == null)
        return Results.BadRequest("Missing X-Player-Token header");

    if (!games.TryGetValue(gameId, out var state))
        return Results.NotFound();

    if (state.Status != GameStatus.PendingDispute || state.PendingClaim == null)
        return Results.BadRequest("There is no pending claim to dispute");

    if (state.PendingClaim.ResponderId != playerId)
        return Results.BadRequest("Only the opponent may dispute this claim");

    var responder = state.Players.Single(player => player.PlayerId == playerId.Value);
    if (responder.DisputesRemaining <= 0)
        return Results.BadRequest("No disputes remaining");

    GameRules.ApplyDisputedClaim(state, state.PendingClaim, dictionary.IsValid(state.PendingClaim.Word));

    return Results.Ok(state);
});

app.Run();

static Guid? GetPlayerId(HttpContext ctx) =>
    ctx.Request.Headers.TryGetValue("X-Player-Token", out var val)
        && Guid.TryParse(val.ToString(), out var id)
        ? id : null;

static char? NormalizeLetter(string? letter)
{
    if (string.IsNullOrWhiteSpace(letter))
        return null;

    var trimmed = letter.Trim();
    if (trimmed.Length != 1)
        return null;

    var character = char.ToUpperInvariant(trimmed[0]);
    return character is >= 'A' and <= 'Z' ? character : null;
}

static bool TryGetPlayer(GameState state, Guid playerId, out Player? player)
{
    player = state.Players.SingleOrDefault(current => current.PlayerId == playerId);
    return player != null;
}

// Models
public enum GameStatus { WaitingForPlayers, InProgress, PendingDispute, Finished }

public record PlayLetterRequest(string Letter);

public record Player(Guid PlayerId, string PlayerName, int TurnOrder)
{
    public int Score { get; set; }
    public int AcceptsRemaining { get; set; } = 5;
    public int DisputesRemaining { get; set; } = 5;
}

public record PendingClaim(Guid ClaimerId, Guid ResponderId, string Word, int BaseScore, int LettersPlacedByClaimer);

public enum ClaimOutcome { Accepted, ValidAfterDispute, InvalidAfterDispute }

public record ClaimResolution(ClaimOutcome Outcome, int ClaimerScoreAwarded, int ResponderScoreAwarded, string Summary);

public record LetterPlay(Guid PlayerId, char Letter);

public class GameState
{
    public Guid GameId { get; set; }
    public GameStatus Status { get; set; }
    public string CurrentWord { get; set; } = "";
    public Guid? ActivePlayerId { get; set; }
    public List<Player> Players { get; set; } = new();
    public PendingClaim? PendingClaim { get; set; }
    public Guid? WinnerPlayerId { get; set; }
    public string? WinnerSummary { get; set; }
    public string? LastResolutionSummary { get; set; }

    [JsonIgnore]
    public List<LetterPlay> CurrentLetters { get; set; } = new();
    public Guid? LastLetterPlayerId { get; set; }
}

public static class TurnRules
{
    public static Guid GetNextPlayerId(IReadOnlyList<Player> players, Guid currentPlayerId)
    {
        if (players.Count == 0)
            throw new ArgumentException("At least one player is required.", nameof(players));

        var currentIndex = players.ToList().FindIndex(player => player.PlayerId == currentPlayerId);
        if (currentIndex < 0)
            throw new ArgumentException("Current player is not part of the game.", nameof(currentPlayerId));

        var nextIndex = (currentIndex + 1) % players.Count;
        return players[nextIndex].PlayerId;
    }

    public static int CountLettersPlacedBy(IEnumerable<LetterPlay> letters, Guid playerId) =>
        letters.Count(letter => letter.PlayerId == playerId);
}

public static class GameRules
{
    public static PendingClaim CreatePendingClaim(GameState state, Guid claimerId)
    {
        var responder = state.Players.Single(player => player.PlayerId != claimerId);
        var claimerLetters = TurnRules.CountLettersPlacedBy(state.CurrentLetters, claimerId);
        var baseScore = claimerLetters * claimerLetters;

        return new PendingClaim(claimerId, responder.PlayerId, state.CurrentWord, baseScore, claimerLetters);
    }

    public static ClaimResolution ApplyAcceptedClaim(GameState state, PendingClaim pendingClaim)
    {
        var responder = state.Players.Single(player => player.PlayerId == pendingClaim.ResponderId);
        var claimer = state.Players.Single(player => player.PlayerId == pendingClaim.ClaimerId);

        responder.AcceptsRemaining -= 1;
        claimer.Score += pendingClaim.BaseScore;

        return FinalizeClaim(
            state,
            pendingClaim,
            new ClaimResolution(
                ClaimOutcome.Accepted,
                pendingClaim.BaseScore,
                0,
                $"{responder.PlayerName} accepted {pendingClaim.Word}. {claimer.PlayerName} scored {pendingClaim.BaseScore}."));
    }

    public static ClaimResolution ApplyDisputedClaim(GameState state, PendingClaim pendingClaim, bool isWordValid)
    {
        var responder = state.Players.Single(player => player.PlayerId == pendingClaim.ResponderId);
        var claimer = state.Players.Single(player => player.PlayerId == pendingClaim.ClaimerId);

        responder.DisputesRemaining -= 1;

        if (isWordValid)
        {
            var finalScore = (int)Math.Floor(pendingClaim.BaseScore * 1.5);
            claimer.Score += finalScore;

            return FinalizeClaim(
                state,
                pendingClaim,
                new ClaimResolution(
                    ClaimOutcome.ValidAfterDispute,
                    finalScore,
                    0,
                    $"{responder.PlayerName} disputed {pendingClaim.Word}, but it is valid. {claimer.PlayerName} scored {finalScore}."));
        }

        var responderScore = (int)Math.Floor(pendingClaim.BaseScore * 0.5);
        responder.Score += responderScore;

        return FinalizeClaim(
            state,
            pendingClaim,
            new ClaimResolution(
                ClaimOutcome.InvalidAfterDispute,
                0,
                responderScore,
                $"{responder.PlayerName} disputed {pendingClaim.Word}, which is invalid. {responder.PlayerName} scored {responderScore}."));
    }

    private static ClaimResolution FinalizeClaim(GameState state, PendingClaim pendingClaim, ClaimResolution resolution)
    {
        state.CurrentWord = string.Empty;
        state.CurrentLetters.Clear();
        state.LastLetterPlayerId = null;
        state.PendingClaim = null;
        state.LastResolutionSummary = resolution.Summary;
        state.ActivePlayerId = pendingClaim.ResponderId;

        if (state.Players.All(player => player.AcceptsRemaining == 0 && player.DisputesRemaining == 0))
        {
            state.Status = GameStatus.Finished;

            var topScore = state.Players.Max(player => player.Score);
            var winners = state.Players.Where(player => player.Score == topScore).ToList();
            if (winners.Count == 1)
            {
                state.WinnerPlayerId = winners[0].PlayerId;
                state.WinnerSummary = $"{winners[0].PlayerName} wins with {winners[0].Score} points.";
            }
            else
            {
                state.WinnerPlayerId = null;
                state.WinnerSummary = $"Draw at {topScore} points.";
            }

            return resolution;
        }

        state.Status = GameStatus.InProgress;
        state.WinnerPlayerId = null;
        state.WinnerSummary = null;
        return resolution;
    }
}

public sealed class WordDictionary
{
    private readonly HashSet<string> words;

    private WordDictionary(HashSet<string> words)
    {
        this.words = words;
    }

    public static async Task<WordDictionary> LoadFromFileAsync(string filePath)
    {
        if (!File.Exists(filePath))
            throw new FileNotFoundException("Dictionary file was not found.", filePath);

        using var stream = File.OpenRead(filePath);
        using var reader = new StreamReader(stream);
        var words = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        while (await reader.ReadLineAsync() is { } line)
        {
            var word = line.Trim();
            if (!IsEligibleWord(word))
                continue;

            words.Add(word.ToUpperInvariant());
        }

        if (words.Count == 0)
            throw new InvalidOperationException("Dictionary file does not contain any usable words.");

        return new WordDictionary(words);
    }

    public bool IsValid(string word) =>
        IsEligibleWord(word)
        && words.Contains(word.ToUpperInvariant());

    private static bool IsEligibleWord(string word) =>
        word.Length >= 3
        && word.All(character => character is (>= 'A' and <= 'Z') or (>= 'a' and <= 'z'));
}
