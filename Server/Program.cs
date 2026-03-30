using System.Collections.Concurrent;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var app = builder.Build();

var games = new ConcurrentDictionary<Guid, GameState>();

// POST /games?playerName=Alice
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

    var playerId = Guid.NewGuid();
    state.Players.Add(new(playerId, playerName, TurnOrder: state.Players.Count));

    // Auto-start with 2+ players
    if (state.Players.Count >= 2)
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

    if (state.ActivePlayerId != playerId)
        return Results.BadRequest("Not your turn");

    // Simple validation
    if (string.IsNullOrWhiteSpace(req.Letter) || req.Letter.Length != 1)
        return Results.BadRequest("Invalid letter");

    state.CurrentWord += req.Letter.ToUpper();

    state.ActivePlayerId = TurnRules.GetNextPlayerId(state.Players, playerId.Value);

    return Results.Ok(new { currentWord = state.CurrentWord, activePlayer = state.ActivePlayerId });
});

app.Run();

static Guid? GetPlayerId(HttpContext ctx) =>
    ctx.Request.Headers.TryGetValue("X-Player-Token", out var val)
        && Guid.TryParse(val.ToString(), out var id)
        ? id : null;

// Models
public enum GameStatus { WaitingForPlayers, InProgress, Finished }

public record PlayLetterRequest(string Letter);

public record Player(Guid PlayerId, string PlayerName, int TurnOrder);

public class GameState
{
    public Guid GameId { get; set; }
    public GameStatus Status { get; set; }
    public string CurrentWord { get; set; } = "";
    public Guid? ActivePlayerId { get; set; }
    public List<Player> Players { get; set; } = new();
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
}
