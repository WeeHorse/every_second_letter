using System.Data.Common;
using System.Text.Json;
using EverySecondLetter.Core.WordGame;
using EverySecondLetter.Services.Database;

namespace EverySecondLetter.Services;

public sealed class GamesService
{
    private readonly IDbConnectionFactory _connections;
    private readonly ISqlDialect _dialect;
    private readonly WordsService _words;
    private readonly WordGameRules _rules;
    private readonly JoinGameEngine _joinGame;
    private readonly StartGameEngine _startGame;
    private readonly PlayLetterEngine _playLetter;
    private readonly ClaimResolutionEngine _claimResolution;

    private sealed record GameRow(
        Guid GameId,
        GameStatus Status,
        string CurrentWord,
        Guid? ActivePlayerId,
        Guid? PendingClaimerId,
        string? PendingWord,
        Guid? LastLetterPlayerId
    );

    private sealed record HistoryRow(
        string Word,
        Guid ClaimerId,
        bool IsValid,
        string PointsJson
    );

    public GamesService(IDbConnectionFactory connections, ISqlDialect dialect, WordsService words, WordGameRules rules, JoinGameEngine joinGame, StartGameEngine startGame, PlayLetterEngine playLetter, ClaimResolutionEngine claimResolution)
    {
        _connections = connections;
        _dialect = dialect;
        _words = words;
        _rules = rules;
        _joinGame = joinGame;
        _startGame = startGame;
        _playLetter = playLetter;
        _claimResolution = claimResolution;
    }

    public async Task<CreateGameResponse> CreateGameAsync(string? playerName)
    {
        var gameId = Guid.NewGuid();
        var playerId = Guid.NewGuid();
        var normalizedPlayerName = NormalizePlayerName(playerName, "Player 1");

        await ExecuteInTransactionAsync(async (conn, tx) =>
        {
            var gameCmd = conn.CreateCommand();
            gameCmd.Transaction = tx;
            gameCmd.CommandText = $"""
                insert into games (
                    id, status, current_word, active_player_id,
                    pending_claimer_id, pending_word,
                    created_at, updated_at, last_letter_player_id)
                values (
                    @id, @status, '', @active,
                    null, null,
                    {_dialect.NowExpression}, {_dialect.NowExpression}, null);
            """;
            AddParam(gameCmd, "id", gameId);
            AddParam(gameCmd, "status", GameStatus.WaitingForPlayers.ToString());
            AddParam(gameCmd, "active", playerId);
            await gameCmd.ExecuteNonQueryAsync();

            await InsertPlayerAsync(conn, tx, gameId, playerId, normalizedPlayerName, turnOrder: 0);
        });

        return new CreateGameResponse(gameId, playerId);
    }

    public async Task<JoinGameResponse> JoinGameAsync(Guid gameId, string? playerName, Guid? existingPlayerToken = null)
    {
        var playerId = Guid.NewGuid();
        var normalizedPlayerName = NormalizePlayerName(playerName, "Player 2");

        return await ExecuteInTransactionAsync(async (conn, tx) =>
        {
            var game = await ReadGameForUpdateAsync(conn, tx, gameId);
            var players = await ReadPlayersForUpdateAsync(conn, tx, gameId);

            var plan = _joinGame.CreatePlan(game.Status, players, playerId, existingPlayerToken);

            if (plan.IsRejoin)
            {
                return new JoinGameResponse(gameId, plan.ResultPlayerId);
            }

            await InsertPlayerAsync(conn, tx, gameId, playerId, normalizedPlayerName, plan.TurnOrder ?? players.Count);
            await UpdateGameAfterJoinAsync(conn, tx, gameId, plan.ShouldStart, plan.ActivePlayerId);

            return new JoinGameResponse(gameId, playerId);
        });
    }

    public async Task<GameStateDto> StartGameAsync(Guid gameId, Guid playerToken)
    {
        await ExecuteInTransactionAsync(async (conn, tx) =>
        {
            var game = await ReadGameForUpdateAsync(conn, tx, gameId);
            var players = await ReadPlayersForUpdateAsync(conn, tx, gameId);
            var plan = _startGame.CreatePlan(game.Status, players, playerToken);

            var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = $"""
                update games
                set status=@status,
                    active_player_id=@active,
                    updated_at={_dialect.NowExpression}
                where id=@id
            """;
            AddParam(cmd, "id", gameId);
            AddParam(cmd, "status", GameStatus.InProgress.ToString());
            AddParam(cmd, "active", plan.ActivePlayerId);
            await cmd.ExecuteNonQueryAsync();
        });

        return await GetStateAsync(gameId);
    }

    public async Task<GameStateDto> GetStateAsync(Guid gameId)
    {
        await using var conn = await _connections.OpenConnectionAsync();

        var game = await ReadGameAsync(conn, gameId);
        var players = await ReadPlayersAsync(conn, gameId);
        var wordHistory = await ReadWordHistoryAsync(conn, gameId);

        return new GameStateDto(
            game.GameId,
            game.Status,
            game.CurrentWord,
            game.ActivePlayerId,
            game.LastLetterPlayerId,
            players,
            game.PendingClaimerId,
            game.PendingWord,
            wordHistory
        );
    }

    public async Task<GameStateDto> PlayLetterAsync(Guid gameId, Guid playerToken, string letter)
    {
        await ExecuteInTransactionAsync(async (conn, tx) =>
        {
            var game = await ReadGameForUpdateAsync(conn, tx, gameId);
            var players = await ReadPlayersForUpdateAsync(conn, tx, gameId);

            var plan = _playLetter.CreatePlan(game.Status, game.CurrentWord, game.ActivePlayerId, players, playerToken, letter);

            var contrib = conn.CreateCommand();
            contrib.Transaction = tx;
            contrib.CommandText = """
                insert into contributions (game_id, player_id, count)
                values (@gid, @pid, 1)
                on conflict (game_id, player_id)
                do update set count = contributions.count + 1
            """;
            AddParam(contrib, "gid", gameId);
            AddParam(contrib, "pid", playerToken);
            await contrib.ExecuteNonQueryAsync();

            var update = conn.CreateCommand();
            update.Transaction = tx;
            update.CommandText = $"""
                update games
                set current_word=@word,
                    active_player_id=@next,
                    last_letter_player_id=@last,
                    updated_at={_dialect.NowExpression}
                where id=@id
            """;
            AddParam(update, "word", plan.UpdatedWord);
            AddParam(update, "next", plan.NextActivePlayerId);
            AddParam(update, "last", plan.LastLetterPlayerId);
            AddParam(update, "id", gameId);
            await update.ExecuteNonQueryAsync();
        });

        return await GetStateAsync(gameId);
    }

    public async Task<GameStateDto> ClaimWordAsync(Guid gameId, Guid playerToken)
    {
        await ExecuteInTransactionAsync(async (conn, tx) =>
        {
            var game = await ReadGameForUpdateAsync(conn, tx, gameId);
            var players = await ReadPlayersForUpdateAsync(conn, tx, gameId);

            EnsurePlayerInGame(players, playerToken);

            if (game.Status != GameStatus.InProgress)
                throw new ApiException(409, "Game is not in progress.");
            if (!_rules.CanClaim(game.CurrentWord, game.LastLetterPlayerId, playerToken))
                throw new ApiException(409, $"Word must be at least {_rules.MinimumClaimLength} letters and be claimed immediately after your last letter.");

            var update = conn.CreateCommand();
            update.Transaction = tx;
            update.CommandText = $"""
                update games
                set status=@status,
                    pending_claimer_id=@claimer,
                    pending_word=@word,
                    updated_at={_dialect.NowExpression}
                where id=@id
            """;
            AddParam(update, "status", GameStatus.PendingDispute.ToString());
            AddParam(update, "claimer", playerToken);
            AddParam(update, "word", game.CurrentWord);
            AddParam(update, "id", gameId);
            await update.ExecuteNonQueryAsync();
        });

        return await GetStateAsync(gameId);
    }

    public async Task<GameStateDto> AcceptClaimAsync(Guid gameId, Guid playerToken)
    {
        return await ResolveClaimAsync(gameId, playerToken, disputed: false);
    }

    public async Task<GameStateDto> DisputeClaimAsync(Guid gameId, Guid playerToken)
    {
        return await ResolveClaimAsync(gameId, playerToken, disputed: true);
    }

    private async Task<GameStateDto> ResolveClaimAsync(Guid gameId, Guid playerToken, bool disputed)
    {
        await ExecuteInTransactionAsync(async (conn, tx) =>
        {
            var game = await ReadGameForUpdateAsync(conn, tx, gameId);
            var players = await ReadPlayersForUpdateAsync(conn, tx, gameId);
            var pendingWord = game.PendingWord ?? throw new ApiException(409, "No pending claim.");

            var contributionCount = await GetContributionCountAsync(conn, tx, gameId, game.PendingClaimerId ?? Guid.Empty);
            var isValidWord = _words.IsValid(pendingWord);

            var plan = _claimResolution.CreatePlan(
                game.Status,
                game.PendingClaimerId,
                pendingWord,
                game.ActivePlayerId,
                players,
                playerToken,
                disputed,
                contributionCount,
                isValidWord);

            foreach (var points in plan.PointEntries.Where(x => x.Points != 0))
            {
                await AddScoreAsync(conn, tx, gameId, points.PlayerId, points.Points);
            }

            await ConsumeResponseAsync(conn, tx, gameId, plan.ResponderId, disputed);
            await InsertWordHistoryAsync(conn, tx, game, plan.PointEntries, isValidWord);

            var reset = conn.CreateCommand();
            reset.Transaction = tx;
            reset.CommandText = plan.GameOver
                ? $"""
                    delete from contributions where game_id=@gid;
                    update games
                    set status=@status,
                        pending_claimer_id=null,
                        pending_word=null,
                        updated_at={_dialect.NowExpression}
                    where id=@gid
                """
                : $"""
                    delete from contributions where game_id=@gid;
                    update games
                    set status=@status,
                        current_word='',
                        active_player_id=@active,
                        pending_claimer_id=null,
                        pending_word=null,
                        last_letter_player_id=null,
                        updated_at={_dialect.NowExpression}
                    where id=@gid
                """;
            AddParam(reset, "gid", gameId);
            AddParam(reset, "status", (plan.GameOver ? GameStatus.Finished : GameStatus.InProgress).ToString());
            if (!plan.GameOver)
                AddParam(reset, "active", plan.NextActivePlayerId);
            await reset.ExecuteNonQueryAsync();
        });

        return await GetStateAsync(gameId);
    }

    private static void EnsurePlayerInGame(IReadOnlyList<GamePlayerState> players, Guid playerToken)
    {
        if (players.All(player => player.PlayerId != playerToken))
            throw new ApiException(401, "Player token is not part of this game.");
    }

    private static GamePlayerState FindPlayer(IReadOnlyList<GamePlayerState> players, Guid playerId)
    {
        var player = players.FirstOrDefault(p => p.PlayerId == playerId);
        if (player is null)
            throw new ApiException(409, "Player is not part of this game.");

        return player;
    }

    private async Task UpdateGameAfterJoinAsync(
        DbConnection conn,
        DbTransaction tx,
        Guid gameId,
        bool shouldStart,
        Guid? activePlayerId)
    {
        var sets = new List<string>();

        if (shouldStart)
        {
            sets.Add("status=@status");
            sets.Add("active_player_id=@active");
        }

        sets.Add($"updated_at={_dialect.NowExpression}");

        var update = conn.CreateCommand();
        update.Transaction = tx;
        update.CommandText = $"""
            update games
            set {string.Join(",\n                ", sets)}
            where id=@id
        """;
        AddParam(update, "id", gameId);

        if (shouldStart)
        {
            AddParam(update, "status", GameStatus.InProgress.ToString());
            AddParam(update, "active", activePlayerId);
        }

        await update.ExecuteNonQueryAsync();
    }

    private async Task InsertPlayerAsync(DbConnection conn, DbTransaction tx, Guid gameId, Guid playerId, string playerName, int turnOrder)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = $"""
            insert into game_players (game_id, player_id, player_name, turn_order, score, accepts_left, disputes_left, joined_at)
            values (@gid, @pid, @playerName, @turnOrder, 0, @accepts, @disputes, {_dialect.NowExpression})
        """;
        AddParam(cmd, "gid", gameId);
        AddParam(cmd, "pid", playerId);
        AddParam(cmd, "playerName", playerName);
        AddParam(cmd, "turnOrder", turnOrder);
        AddParam(cmd, "accepts", _rules.InitialAccepts);
        AddParam(cmd, "disputes", _rules.InitialDisputes);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task<GameRow> ReadGameAsync(DbConnection conn, Guid gameId)
    {
        var cmd = conn.CreateCommand();
        cmd.CommandText = """
             select id, status, current_word, active_player_id, pending_claimer_id,
                 pending_word, last_letter_player_id
            from games
            where id=@id
        """;
        AddParam(cmd, "id", gameId);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            throw new ApiException(404, "Game not found.");

        return MapGameRow(reader);
    }

    private async Task<GameRow> ReadGameForUpdateAsync(DbConnection conn, DbTransaction tx, Guid gameId)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = $"""
            select id, status, current_word, active_player_id, pending_claimer_id,
                 pending_word, last_letter_player_id
            from games
            where id=@id
            {_dialect.ForUpdateClause}
        """;
        AddParam(cmd, "id", gameId);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            throw new ApiException(404, "Game not found.");

        return MapGameRow(reader);
    }

    private static GameRow MapGameRow(DbDataReader reader)
    {
        var statusText = reader.GetString(1);
        if (!Enum.TryParse<GameStatus>(statusText, ignoreCase: true, out var status))
            throw new ApiException(500, $"Invalid game status in database: '{statusText}'.");

        return new GameRow(
            ReadGuid(reader, 0),
            status,
            reader.GetString(2),
            ReadNullableGuid(reader, 3),
            ReadNullableGuid(reader, 4),
            reader.IsDBNull(5) ? null : reader.GetString(5),
            ReadNullableGuid(reader, 6)
        );
    }

    private async Task<List<GamePlayerState>> ReadPlayersAsync(DbConnection conn, Guid gameId)
    {
        var cmd = conn.CreateCommand();
        cmd.CommandText = """
            select player_id, player_name, turn_order, score, accepts_left, disputes_left
            from game_players
            where game_id=@gid
            order by turn_order asc
        """;
        AddParam(cmd, "gid", gameId);

        var result = new List<GamePlayerState>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            result.Add(MapPlayerState(reader));
        }
        return result;
    }

    private async Task<List<GamePlayerState>> ReadPlayersForUpdateAsync(DbConnection conn, DbTransaction tx, Guid gameId)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = $"""
            select player_id, player_name, turn_order, score, accepts_left, disputes_left
            from game_players
            where game_id=@gid
            order by turn_order asc
            {_dialect.ForUpdateClause}
        """;
        AddParam(cmd, "gid", gameId);

        var result = new List<GamePlayerState>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            result.Add(MapPlayerState(reader));
        }
        return result;
    }

    private static string NormalizePlayerName(string? playerName, string fallback)
    {
        if (string.IsNullOrWhiteSpace(playerName))
            return fallback;

        return playerName.Trim();
    }

    private static async Task<int> GetContributionCountAsync(DbConnection conn, DbTransaction tx, Guid gameId, Guid playerId)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = "select coalesce(count, 0) from contributions where game_id=@gid and player_id=@pid";
        AddParam(cmd, "gid", gameId);
        AddParam(cmd, "pid", playerId);
        var value = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(value);
    }

    private static async Task AddScoreAsync(DbConnection conn, DbTransaction tx, Guid gameId, Guid playerId, int delta)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            update game_players
            set score = score + @delta
            where game_id=@gid and player_id=@pid
        """;
        AddParam(cmd, "delta", delta);
        AddParam(cmd, "gid", gameId);
        AddParam(cmd, "pid", playerId);
        var rows = await cmd.ExecuteNonQueryAsync();
        if (rows == 0)
            throw new ApiException(500, "Player score row missing.");
    }

    private static async Task ConsumeResponseAsync(DbConnection conn, DbTransaction tx, Guid gameId, Guid playerId, bool disputed)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = disputed
            ? "update game_players set disputes_left = disputes_left - 1 where game_id=@gid and player_id=@pid"
            : "update game_players set accepts_left = accepts_left - 1 where game_id=@gid and player_id=@pid";
        AddParam(cmd, "gid", gameId);
        AddParam(cmd, "pid", playerId);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task InsertWordHistoryAsync(
        DbConnection conn,
        DbTransaction tx,
        GameRow game,
        List<PlayerPoints> pointEntries,
        bool isValidWord)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = $"""
            insert into word_history (id, game_id, word, claimer_id, is_valid, created_at, points_json)
            values (@id, @gid, @word, @claimer, @valid, {_dialect.NowExpression}, {_dialect.JsonParameter("@points")})
        """;
        AddParam(cmd, "id", Guid.NewGuid());
        AddParam(cmd, "gid", game.GameId);
        AddParam(cmd, "word", game.PendingWord ?? string.Empty);
        AddParam(cmd, "claimer", game.PendingClaimerId ?? Guid.Empty);
        AddParam(cmd, "valid", isValidWord);
        AddParam(cmd, "points", JsonSerializer.Serialize(pointEntries));
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task<List<WordHistoryEntry>> ReadWordHistoryAsync(DbConnection conn, Guid gameId)
    {
        var cmd = conn.CreateCommand();
        cmd.CommandText = $"""
            select word, claimer_id, is_valid, coalesce({_dialect.JsonToText("points_json")}, '[]')
            from word_history
            where game_id=@gid
            order by created_at asc
        """;
        AddParam(cmd, "gid", gameId);

        var rows = new List<HistoryRow>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            rows.Add(MapHistoryRow(reader));
        }

        return rows.Select(row =>
        {
            var points = JsonSerializer.Deserialize<List<PlayerPoints>>(row.PointsJson) ?? new List<PlayerPoints>();

            return new WordHistoryEntry(
                row.Word,
                row.ClaimerId,
                points,
                row.IsValid
            );
        }).ToList();
    }

    private static void AddParam(DbCommand cmd, string name, object? value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value ?? DBNull.Value;
        cmd.Parameters.Add(p);
    }

    private async Task ExecuteInTransactionAsync(Func<DbConnection, DbTransaction, Task> action)
    {
        await using var conn = await _connections.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        try
        {
            await action(conn, tx);
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    private async Task<T> ExecuteInTransactionAsync<T>(Func<DbConnection, DbTransaction, Task<T>> action)
    {
        await using var conn = await _connections.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        try
        {
            var result = await action(conn, tx);
            await tx.CommitAsync();
            return result;
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    private static GamePlayerState MapPlayerState(DbDataReader reader)
    {
        return new GamePlayerState(
            ReadGuid(reader, 0),
            reader.GetString(1),
            reader.GetInt32(2),
            reader.GetInt32(3),
            reader.GetInt32(4),
            reader.GetInt32(5)
        );
    }

    private static HistoryRow MapHistoryRow(DbDataReader reader)
    {
        return new HistoryRow(
            reader.GetString(0),
            ReadGuid(reader, 1),
            ReadBool(reader, 2),
            reader.GetString(3)
        );
    }

    private static Guid ReadGuid(DbDataReader reader, int ordinal)
    {
        var raw = reader.GetValue(ordinal);
        return raw switch
        {
            Guid guid => guid,
            string str => Guid.Parse(str),
            byte[] bytes => new Guid(bytes),
            _ => Guid.Parse(Convert.ToString(raw) ?? throw new ApiException(500, "Invalid GUID value in database."))
        };
    }

    private static Guid? ReadNullableGuid(DbDataReader reader, int ordinal)
    {
        if (reader.IsDBNull(ordinal))
            return null;
        return ReadGuid(reader, ordinal);
    }

    private static bool ReadBool(DbDataReader reader, int ordinal)
    {
        var raw = reader.GetValue(ordinal);
        return raw switch
        {
            bool b => b,
            long l => l != 0,
            int i => i != 0,
            string s => bool.TryParse(s, out var parsed) ? parsed : s != "0",
            _ => Convert.ToBoolean(raw)
        };
    }
}
