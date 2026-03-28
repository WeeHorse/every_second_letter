using System.Text.Json;
using Npgsql;
using EverySecondLetter.Gameplay.EverySecondLetter;

namespace EverySecondLetter.Services;

public sealed class GamesService
{
    private readonly NpgsqlDataSource _ds;
    private readonly WordsService _words;
    private readonly EverySecondLetterGameDefinition _definition;

    private sealed record GameRow(
        Guid GameId,
        GameStatus Status,
        string CurrentWord,
        Guid? ActivePlayerId,
        Guid? PendingClaimerId,
        string? PendingWord,
        Guid? LastLetterPlayerId,
        Guid LegacyPlayer1Id,
        Guid? LegacyPlayer2Id
    );

    private sealed record HistoryRow(
        string Word,
        Guid ClaimerId,
        bool IsValid,
        int LegacyPlayer1Points,
        int LegacyPlayer2Points,
        string PointsJson
    );

    public GamesService(NpgsqlDataSource ds, WordsService words, EverySecondLetterGameDefinition definition)
    {
        _ds = ds;
        _words = words;
        _definition = definition;
    }

    public async Task<CreateGameResponse> CreateGameAsync()
    {
        var gameId = Guid.NewGuid();
        var playerId = Guid.NewGuid();

        await using var conn = await _ds.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        try
        {
            var gameCmd = conn.CreateCommand();
            gameCmd.Transaction = tx;
            gameCmd.CommandText = """
                insert into games (
                    id, status, current_word, active_player_id, player1_id, player2_id,
                    pending_claimer_id, pending_word,
                    p1_accepts, p1_disputes, p2_accepts, p2_disputes,
                    created_at, updated_at, last_letter_player_id)
                values (
                    @id, @status, '', @active, @p1, null,
                    null, null,
                    @accepts, @disputes, @accepts, @disputes,
                    now(), now(), null);
            """;
            gameCmd.Parameters.AddWithValue("id", gameId);
            gameCmd.Parameters.AddWithValue("status", GameStatus.WaitingForPlayers.ToString());
            gameCmd.Parameters.AddWithValue("active", playerId);
            gameCmd.Parameters.AddWithValue("p1", playerId);
            gameCmd.Parameters.AddWithValue("accepts", _definition.InitialAccepts);
            gameCmd.Parameters.AddWithValue("disputes", _definition.InitialDisputes);
            await gameCmd.ExecuteNonQueryAsync();

            await InsertPlayerAsync(conn, tx, gameId, playerId, turnOrder: 0);
            await InsertLegacyScoreAsync(conn, tx, gameId, playerId);

            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return new CreateGameResponse(gameId, playerId);
    }

    public async Task<JoinGameResponse> JoinGameAsync(Guid gameId, Guid? existingPlayerToken = null)
    {
        var playerId = Guid.NewGuid();

        await using var conn = await _ds.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        try
        {
            var game = await ReadGameForUpdateAsync(conn, tx, gameId);
            var players = await ReadPlayersForUpdateAsync(conn, tx, gameId);

            if (existingPlayerToken.HasValue && players.Any(player => player.PlayerId == existingPlayerToken.Value))
            {
                await tx.CommitAsync();
                return new JoinGameResponse(gameId, existingPlayerToken.Value);
            }

            if (!_definition.CanJoin(game.Status, players.Count))
                throw new ApiException(409, "Game is not joinable.");

            var nextTurnOrder = players.Count;

            await InsertPlayerAsync(conn, tx, gameId, playerId, nextTurnOrder);
            await InsertLegacyScoreAsync(conn, tx, gameId, playerId);

            var joinedPlayerCount = players.Count + 1;
            var shouldStart = _definition.ShouldStart(joinedPlayerCount);

            var update = conn.CreateCommand();
            update.Transaction = tx;
            update.CommandText = shouldStart
                ? """
                    update games
                    set status=@status,
                        active_player_id=@active,
                        player2_id=coalesce(player2_id, @joinedPlayer),
                        updated_at=now()
                    where id=@id
                """
                : """
                    update games
                    set player2_id=coalesce(player2_id, @joinedPlayer),
                        updated_at=now()
                    where id=@id
                """;
            update.Parameters.AddWithValue("id", gameId);
            update.Parameters.AddWithValue("joinedPlayer", playerId);
            if (shouldStart)
            {
                update.Parameters.AddWithValue("status", GameStatus.InProgress.ToString());
                update.Parameters.AddWithValue("active", players[0].PlayerId);
            }
            await update.ExecuteNonQueryAsync();

            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return new JoinGameResponse(gameId, playerId);
    }

    public async Task<GameStateDto> GetStateAsync(Guid gameId)
    {
        await using var conn = await _ds.OpenConnectionAsync();

        var game = await ReadGameAsync(conn, gameId);
        var players = await ReadPlayersAsync(conn, gameId);
        var wordHistory = await ReadWordHistoryAsync(conn, gameId, players);

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
        var normalized = _definition.NormalizeLetter(letter);

        await using var conn = await _ds.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        try
        {
            var game = await ReadGameForUpdateAsync(conn, tx, gameId);
            var players = await ReadPlayersForUpdateAsync(conn, tx, gameId);

            EnsurePlayerInGame(players, playerToken);

            if (game.Status != GameStatus.InProgress)
                throw new ApiException(409, "Game is not in progress.");
            if (game.ActivePlayerId != playerToken)
                throw new ApiException(409, "Not your turn.");

            var nextPlayerId = _definition.GetNextPlayerId(players, playerToken);

            var contrib = conn.CreateCommand();
            contrib.Transaction = tx;
            contrib.CommandText = """
                insert into contributions (game_id, player_id, count)
                values (@gid, @pid, 1)
                on conflict (game_id, player_id)
                do update set count = contributions.count + 1
            """;
            contrib.Parameters.AddWithValue("gid", gameId);
            contrib.Parameters.AddWithValue("pid", playerToken);
            await contrib.ExecuteNonQueryAsync();

            var update = conn.CreateCommand();
            update.Transaction = tx;
            update.CommandText = """
                update games
                set current_word=@word,
                    active_player_id=@next,
                    last_letter_player_id=@last,
                    updated_at=now()
                where id=@id
            """;
            update.Parameters.AddWithValue("word", game.CurrentWord + normalized);
            update.Parameters.AddWithValue("next", nextPlayerId);
            update.Parameters.AddWithValue("last", playerToken);
            update.Parameters.AddWithValue("id", gameId);
            await update.ExecuteNonQueryAsync();

            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return await GetStateAsync(gameId);
    }

    public async Task<GameStateDto> ClaimWordAsync(Guid gameId, Guid playerToken)
    {
        await using var conn = await _ds.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        try
        {
            var game = await ReadGameForUpdateAsync(conn, tx, gameId);
            var players = await ReadPlayersForUpdateAsync(conn, tx, gameId);

            EnsurePlayerInGame(players, playerToken);

            if (game.Status != GameStatus.InProgress)
                throw new ApiException(409, "Game is not in progress.");
            if (!_definition.CanClaim(game.CurrentWord, game.LastLetterPlayerId, playerToken))
                throw new ApiException(409, $"Word must be at least {_definition.MinimumClaimLength} letters and be claimed immediately after your last letter.");

            var update = conn.CreateCommand();
            update.Transaction = tx;
            update.CommandText = """
                update games
                set status=@status,
                    pending_claimer_id=@claimer,
                    pending_word=@word,
                    updated_at=now()
                where id=@id
            """;
            update.Parameters.AddWithValue("status", GameStatus.PendingDispute.ToString());
            update.Parameters.AddWithValue("claimer", playerToken);
            update.Parameters.AddWithValue("word", game.CurrentWord);
            update.Parameters.AddWithValue("id", gameId);
            await update.ExecuteNonQueryAsync();

            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

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
        await using var conn = await _ds.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        try
        {
            var game = await ReadGameForUpdateAsync(conn, tx, gameId);
            var players = await ReadPlayersForUpdateAsync(conn, tx, gameId);

            if (game.Status != GameStatus.PendingDispute || game.PendingClaimerId is null || string.IsNullOrWhiteSpace(game.PendingWord))
                throw new ApiException(409, "No pending claim.");

            EnsurePlayerInGame(players, playerToken);

            var claimerId = game.PendingClaimerId.Value;
            var responderId = game.ActivePlayerId ?? throw new ApiException(409, "Game has no active responder.");
            if (playerToken != responderId)
                throw new ApiException(409, "Only the active player may accept/dispute.");

            var responder = FindPlayer(players, responderId);
            var availableResponses = disputed ? responder.DisputesRemaining : responder.AcceptsRemaining;
            if (availableResponses <= 0)
                throw new ApiException(409, "No remaining accepts/disputes available.");

            var baseScore = _definition.GetBaseScore(await GetContributionCountAsync(conn, tx, gameId, claimerId));
            var isValidWord = _words.IsValid(game.PendingWord);

            var pointEntries = new List<PlayerPoints>();
            if (!disputed)
            {
                pointEntries.Add(new PlayerPoints(claimerId, _definition.GetAcceptedScore(baseScore)));
            }
            else if (isValidWord)
            {
                pointEntries.Add(new PlayerPoints(claimerId, _definition.GetValidDisputedScore(baseScore)));
            }
            else
            {
                pointEntries.Add(new PlayerPoints(responderId, _definition.GetInvalidDisputedScore(baseScore)));
            }

            foreach (var points in pointEntries.Where(x => x.Points != 0))
            {
                await AddScoreAsync(conn, tx, gameId, points.PlayerId, points.Points);
                await AddLegacyScoreAsync(conn, tx, gameId, points.PlayerId, points.Points);
            }

            await ConsumeResponseAsync(conn, tx, gameId, responderId, disputed, players);
            await InsertWordHistoryAsync(conn, tx, game, pointEntries, isValidWord, players);

            var refreshedPlayers = await ReadPlayersForUpdateAsync(conn, tx, gameId);
            var gameOver = refreshedPlayers.All(player => player.AcceptsRemaining + player.DisputesRemaining == 0);

            var reset = conn.CreateCommand();
            reset.Transaction = tx;
            reset.CommandText = gameOver
                ? """
                    delete from contributions where game_id=@gid;
                    update games
                    set status=@status,
                        pending_claimer_id=null,
                        pending_word=null,
                        updated_at=now()
                    where id=@gid
                """
                : """
                    delete from contributions where game_id=@gid;
                    update games
                    set status=@status,
                        current_word='',
                        active_player_id=@active,
                        pending_claimer_id=null,
                        pending_word=null,
                        last_letter_player_id=null,
                        updated_at=now()
                    where id=@gid
                """;
            reset.Parameters.AddWithValue("gid", gameId);
            reset.Parameters.AddWithValue("status", (gameOver ? GameStatus.Finished : GameStatus.InProgress).ToString());
            if (!gameOver)
                reset.Parameters.AddWithValue("active", responderId);
            await reset.ExecuteNonQueryAsync();

            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

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

    private async Task InsertPlayerAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid gameId, Guid playerId, int turnOrder)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            insert into game_players (game_id, player_id, turn_order, score, accepts_left, disputes_left, joined_at)
            values (@gid, @pid, @turnOrder, 0, @accepts, @disputes, now())
        """;
        cmd.Parameters.AddWithValue("gid", gameId);
        cmd.Parameters.AddWithValue("pid", playerId);
        cmd.Parameters.AddWithValue("turnOrder", turnOrder);
        cmd.Parameters.AddWithValue("accepts", _definition.InitialAccepts);
        cmd.Parameters.AddWithValue("disputes", _definition.InitialDisputes);
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task InsertLegacyScoreAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid gameId, Guid playerId)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            insert into scores (game_id, player_id, score)
            values (@gid, @pid, 0)
            on conflict (game_id, player_id) do nothing
        """;
        cmd.Parameters.AddWithValue("gid", gameId);
        cmd.Parameters.AddWithValue("pid", playerId);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task<GameRow> ReadGameAsync(NpgsqlConnection conn, Guid gameId)
    {
        var cmd = conn.CreateCommand();
        cmd.CommandText = """
            select id, status, current_word, active_player_id, pending_claimer_id,
                   pending_word, last_letter_player_id, player1_id, player2_id
            from games
            where id=@id
        """;
        cmd.Parameters.AddWithValue("id", gameId);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            throw new ApiException(404, "Game not found.");

        return MapGameRow(reader);
    }

    private async Task<GameRow> ReadGameForUpdateAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid gameId)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            select id, status, current_word, active_player_id, pending_claimer_id,
                   pending_word, last_letter_player_id, player1_id, player2_id
            from games
            where id=@id
            for update
        """;
        cmd.Parameters.AddWithValue("id", gameId);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            throw new ApiException(404, "Game not found.");

        return MapGameRow(reader);
    }

    private static GameRow MapGameRow(NpgsqlDataReader reader)
    {
        return new GameRow(
            reader.GetGuid(0),
            Enum.Parse<GameStatus>(reader.GetString(1)),
            reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetGuid(3),
            reader.IsDBNull(4) ? null : reader.GetGuid(4),
            reader.IsDBNull(5) ? null : reader.GetString(5),
            reader.IsDBNull(6) ? null : reader.GetGuid(6),
            reader.GetGuid(7),
            reader.IsDBNull(8) ? null : reader.GetGuid(8)
        );
    }

    private async Task<List<GamePlayerState>> ReadPlayersAsync(NpgsqlConnection conn, Guid gameId)
    {
        var cmd = conn.CreateCommand();
        cmd.CommandText = """
            select player_id, turn_order, score, accepts_left, disputes_left
            from game_players
            where game_id=@gid
            order by turn_order asc
        """;
        cmd.Parameters.AddWithValue("gid", gameId);

        var result = new List<GamePlayerState>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            result.Add(new GamePlayerState(
                reader.GetGuid(0),
                reader.GetInt32(1),
                reader.GetInt32(2),
                reader.GetInt32(3),
                reader.GetInt32(4)
            ));
        }
        return result;
    }

    private async Task<List<GamePlayerState>> ReadPlayersForUpdateAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid gameId)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            select player_id, turn_order, score, accepts_left, disputes_left
            from game_players
            where game_id=@gid
            order by turn_order asc
            for update
        """;
        cmd.Parameters.AddWithValue("gid", gameId);

        var result = new List<GamePlayerState>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            result.Add(new GamePlayerState(
                reader.GetGuid(0),
                reader.GetInt32(1),
                reader.GetInt32(2),
                reader.GetInt32(3),
                reader.GetInt32(4)
            ));
        }
        return result;
    }

    private async Task<int> GetContributionCountAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid gameId, Guid playerId)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = "select coalesce(count, 0) from contributions where game_id=@gid and player_id=@pid";
        cmd.Parameters.AddWithValue("gid", gameId);
        cmd.Parameters.AddWithValue("pid", playerId);
        var value = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(value);
    }

    private static async Task AddScoreAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid gameId, Guid playerId, int delta)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            update game_players
            set score = score + @delta
            where game_id=@gid and player_id=@pid
        """;
        cmd.Parameters.AddWithValue("delta", delta);
        cmd.Parameters.AddWithValue("gid", gameId);
        cmd.Parameters.AddWithValue("pid", playerId);
        var rows = await cmd.ExecuteNonQueryAsync();
        if (rows == 0)
            throw new ApiException(500, "Player score row missing.");
    }

    private static async Task AddLegacyScoreAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid gameId, Guid playerId, int delta)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            update scores
            set score = score + @delta
            where game_id=@gid and player_id=@pid
        """;
        cmd.Parameters.AddWithValue("delta", delta);
        cmd.Parameters.AddWithValue("gid", gameId);
        cmd.Parameters.AddWithValue("pid", playerId);
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task ConsumeResponseAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid gameId, Guid playerId, bool disputed, IReadOnlyList<GamePlayerState> players)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = disputed
            ? "update game_players set disputes_left = disputes_left - 1 where game_id=@gid and player_id=@pid"
            : "update game_players set accepts_left = accepts_left - 1 where game_id=@gid and player_id=@pid";
        cmd.Parameters.AddWithValue("gid", gameId);
        cmd.Parameters.AddWithValue("pid", playerId);
        await cmd.ExecuteNonQueryAsync();

        var index = players.ToList().FindIndex(player => player.PlayerId == playerId);
        if (index is 0 or 1)
        {
            var legacy = conn.CreateCommand();
            legacy.Transaction = tx;
            legacy.CommandText = index == 0
                ? (disputed
                    ? "update games set p1_disputes = greatest(p1_disputes - 1, 0) where id=@gid"
                    : "update games set p1_accepts = greatest(p1_accepts - 1, 0) where id=@gid")
                : (disputed
                    ? "update games set p2_disputes = greatest(p2_disputes - 1, 0) where id=@gid"
                    : "update games set p2_accepts = greatest(p2_accepts - 1, 0) where id=@gid");
            legacy.Parameters.AddWithValue("gid", gameId);
            await legacy.ExecuteNonQueryAsync();
        }
    }

    private async Task InsertWordHistoryAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        GameRow game,
        List<PlayerPoints> pointEntries,
        bool isValidWord,
        IReadOnlyList<GamePlayerState> players)
    {
        var player1Id = players.Count > 0 ? players[0].PlayerId : (Guid?)null;
        var player2Id = players.Count > 1 ? players[1].PlayerId : (Guid?)null;
        var player1Points = player1Id is null ? 0 : pointEntries.Where(x => x.PlayerId == player1Id.Value).Sum(x => x.Points);
        var player2Points = player2Id is null ? 0 : pointEntries.Where(x => x.PlayerId == player2Id.Value).Sum(x => x.Points);

        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            insert into word_history (id, game_id, word, claimer_id, p1_points, p2_points, is_valid, created_at, points_json)
            values (@id, @gid, @word, @claimer, @p1, @p2, @valid, now(), @points::jsonb)
        """;
        cmd.Parameters.AddWithValue("id", Guid.NewGuid());
        cmd.Parameters.AddWithValue("gid", game.GameId);
        cmd.Parameters.AddWithValue("word", game.PendingWord ?? string.Empty);
        cmd.Parameters.AddWithValue("claimer", game.PendingClaimerId ?? Guid.Empty);
        cmd.Parameters.AddWithValue("p1", player1Points);
        cmd.Parameters.AddWithValue("p2", player2Points);
        cmd.Parameters.AddWithValue("valid", isValidWord);
        cmd.Parameters.AddWithValue("points", JsonSerializer.Serialize(pointEntries));
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task<List<WordHistoryEntry>> ReadWordHistoryAsync(NpgsqlConnection conn, Guid gameId, IReadOnlyList<GamePlayerState> players)
    {
        var cmd = conn.CreateCommand();
        cmd.CommandText = """
            select word, claimer_id, is_valid, p1_points, p2_points, coalesce(points_json::text, '[]')
            from word_history
            where game_id=@gid
            order by created_at asc
        """;
        cmd.Parameters.AddWithValue("gid", gameId);

        var rows = new List<HistoryRow>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            rows.Add(new HistoryRow(
                reader.GetString(0),
                reader.GetGuid(1),
                reader.GetBoolean(2),
                reader.GetInt32(3),
                reader.GetInt32(4),
                reader.GetString(5)
            ));
        }

        var player1Id = players.Count > 0 ? players[0].PlayerId : (Guid?)null;
        var player2Id = players.Count > 1 ? players[1].PlayerId : (Guid?)null;

        return rows.Select(row =>
        {
            var points = JsonSerializer.Deserialize<List<PlayerPoints>>(row.PointsJson) ?? new List<PlayerPoints>();
            if (points.Count == 0)
            {
                if (player1Id.HasValue && row.LegacyPlayer1Points != 0)
                    points.Add(new PlayerPoints(player1Id.Value, row.LegacyPlayer1Points));
                if (player2Id.HasValue && row.LegacyPlayer2Points != 0)
                    points.Add(new PlayerPoints(player2Id.Value, row.LegacyPlayer2Points));
            }

            return new WordHistoryEntry(
                row.Word,
                row.ClaimerId,
                points,
                row.IsValid,
                row.LegacyPlayer1Points,
                row.LegacyPlayer2Points
            );
        }).ToList();
    }
}
