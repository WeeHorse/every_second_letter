using System.Text.Json.Serialization;
using Npgsql;
using EverySecondLetter.Services;
using EverySecondLetter.DTOs;

var builder = WebApplication.CreateBuilder(args);

// ---- Config ----
// Prefer "ConnectionStrings:Default" but accept DATABASE_URL for convenience.
var connStr = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connStr))
{
    var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
    if (!string.IsNullOrWhiteSpace(databaseUrl))
        connStr = Db.FromDatabaseUrl(databaseUrl);
}
if (string.IsNullOrWhiteSpace(connStr))
    throw new InvalidOperationException("Missing Postgres connection string. Set ConnectionStrings:Default or DATABASE_URL.");

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

builder.Services.AddSingleton(new NpgsqlDataSourceBuilder(connStr).Build());
builder.Services.AddSingleton<WordsService>();
builder.Services.AddSingleton<GamesService>();

var app = builder.Build();

// ---- Initialize database ----
var ds = app.Services.GetRequiredService<NpgsqlDataSource>();
await SeedDb.InitializeAsync(ds);

// ---- Lightweight API error -> ProblemDetails ----
app.Use(async (ctx, next) =>
{
    try
    {
        await next();
    }
    catch (EverySecondLetter.Services.ApiException ex)
    {
        ctx.Response.StatusCode = ex.StatusCode;
        await ctx.Response.WriteAsJsonAsync(new { error = ex.Message, status = ex.StatusCode });
    }
});

// if (app.Environment.IsDevelopment())
app.UseDeveloperExceptionPage();
// }
app.UseDefaultFiles();
app.UseStaticFiles();

// ---- Routes (outer imperative layer) ----

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/client-ip", (HttpContext ctx) =>
{
    var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    return Results.Ok(new { ip });
});

app.MapPost("/games", async (GamesService games) =>
{
    var result = await games.CreateGameAsync();
    return Results.Created($"/games/{result.GameId}", result);
});

app.MapPost("/games/{gameId:guid}/join", async (Guid gameId, GamesService games) =>
{
    var result = await games.JoinGameAsync(gameId);
    return Results.Ok(result);
});

app.MapGet("/games/{gameId:guid}", async (Guid gameId, GamesService games) =>
{
    var state = await games.GetStateAsync(gameId);
    return Results.Ok(state);
});

app.MapPost("/games/{gameId:guid}/letter", async (Guid gameId, PlayLetterRequest req, HttpRequest http, GamesService games) =>
{
    var playerToken = RequirePlayerToken(http);
    var state = await games.PlayLetterAsync(gameId, playerToken, req.Letter);
    return Results.Ok(state);
});

app.MapPost("/games/{gameId:guid}/claim", async (Guid gameId, HttpRequest http, GamesService games) =>
{
    var playerToken = RequirePlayerToken(http);
    var state = await games.ClaimWordAsync(gameId, playerToken);
    return Results.Ok(state);
});

app.MapPost("/games/{gameId:guid}/accept", async (Guid gameId, HttpRequest http, GamesService games) =>
{
    var playerToken = RequirePlayerToken(http);
    var state = await games.AcceptClaimAsync(gameId, playerToken);
    return Results.Ok(state);
});

app.MapPost("/games/{gameId:guid}/dispute", async (Guid gameId, HttpRequest http, GamesService games) =>
{
    var playerToken = RequirePlayerToken(http);
    var state = await games.DisputeClaimAsync(gameId, playerToken);
    return Results.Ok(state);
});

app.MapPost("/games/{gameId:guid}/validate-word", (Guid gameId, ValidateWordRequest req, WordsService words) =>
{
    if (string.IsNullOrWhiteSpace(req.Word))
        throw new ApiException(400, "Word is required.");

    var isValid = words.IsValid(req.Word);
    return Results.Ok(new { word = req.Word, valid = isValid });
});

app.Run();

static Guid RequirePlayerToken(HttpRequest http)
{
    if (!http.Headers.TryGetValue("X-Player-Token", out var values))
        throw new ApiException(401, "Missing X-Player-Token header.");
    if (!Guid.TryParse(values.FirstOrDefault(), out var token))
        throw new ApiException(401, "Invalid X-Player-Token header.");
    return token;
}
