using EverySecondLetter.Core.WordGame;
using EverySecondLetter.Services;

namespace EverySecondLetter.Api;

public static class GameEndpoints
{
    public static IEndpointRouteBuilder MapGameEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/health", () => Results.Ok(new { status = "ok" }));

        endpoints.MapGet("/client-ip", (HttpContext ctx) =>
        {
            var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            return Results.Ok(new { ip });
        });

        endpoints.MapPost("/games", async (PlayerRegistrationRequest? req, GamesService games) =>
        {
            var result = await games.CreateGameAsync(req?.PlayerName);
            return Results.Created($"/games/{result.GameId}", result);
        });

        endpoints.MapPost("/games/{gameId:guid}/join", async (Guid gameId, PlayerRegistrationRequest? req, HttpRequest http, GamesService games) =>
        {
            var playerToken = TryGetPlayerToken(http);
            var result = await games.JoinGameAsync(gameId, req?.PlayerName, playerToken);
            return Results.Ok(result);
        });

        endpoints.MapPost("/games/{gameId:guid}/start", async (Guid gameId, HttpRequest http, GamesService games) =>
        {
            var playerToken = RequirePlayerToken(http);
            var state = await games.StartGameAsync(gameId, playerToken);
            return Results.Ok(state);
        });

        endpoints.MapGet("/games/{gameId:guid}", async (Guid gameId, GamesService games) =>
        {
            var state = await games.GetStateAsync(gameId);
            return Results.Ok(state);
        });

        endpoints.MapPost("/games/{gameId:guid}/letter", async (Guid gameId, PlayLetterRequest req, HttpRequest http, GamesService games) =>
        {
            var playerToken = RequirePlayerToken(http);
            var state = await games.PlayLetterAsync(gameId, playerToken, req.Letter);
            return Results.Ok(state);
        });

        endpoints.MapPost("/games/{gameId:guid}/claim", async (Guid gameId, HttpRequest http, GamesService games) =>
        {
            var playerToken = RequirePlayerToken(http);
            var state = await games.ClaimWordAsync(gameId, playerToken);
            return Results.Ok(state);
        });

        endpoints.MapPost("/games/{gameId:guid}/accept", async (Guid gameId, HttpRequest http, GamesService games) =>
        {
            var playerToken = RequirePlayerToken(http);
            var state = await games.AcceptClaimAsync(gameId, playerToken);
            return Results.Ok(state);
        });

        endpoints.MapPost("/games/{gameId:guid}/dispute", async (Guid gameId, HttpRequest http, GamesService games) =>
        {
            var playerToken = RequirePlayerToken(http);
            var state = await games.DisputeClaimAsync(gameId, playerToken);
            return Results.Ok(state);
        });

        endpoints.MapPost("/games/{gameId:guid}/validate-word", (Guid gameId, ValidateWordRequest req, WordsService words) =>
        {
            if (string.IsNullOrWhiteSpace(req.Word))
                throw new ApiException(400, "Word is required.");

            var isValid = words.IsValid(req.Word);
            return Results.Ok(new { word = req.Word, valid = isValid });
        });

        return endpoints;
    }

    private static Guid RequirePlayerToken(HttpRequest http)
    {
        if (!http.Headers.TryGetValue("X-Player-Token", out var values))
            throw new ApiException(401, "Missing X-Player-Token header.");

        if (!Guid.TryParse(values.FirstOrDefault(), out var token))
            throw new ApiException(401, "Invalid X-Player-Token header.");

        return token;
    }

    private static Guid? TryGetPlayerToken(HttpRequest http)
    {
        if (!http.Headers.TryGetValue("X-Player-Token", out var values))
            return null;

        return Guid.TryParse(values.FirstOrDefault(), out var token) ? token : null;
    }
}
