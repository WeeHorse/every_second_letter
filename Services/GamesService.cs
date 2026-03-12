using Npgsql;
using EverySecondLetter.DTOs;

namespace EverySecondLetter.Services;

public enum GameStatus
{
    WaitingForPlayers,
    InProgress,
    PendingDispute
}

public sealed class GamesService
{
    private readonly NpgsqlDataSource _ds;
    private readonly WordsService _words;
    private const int MinLength = 3;

    private sealed record GameRow(
        Guid GameId,
        GameStatus Status,
        string CurrentWord,
        Guid ActivePlayerId,
        Guid Player1Id,
        Guid? Player2Id,
        Guid? PendingClaimerId,
        string? PendingWord,
        Guid? LastLetterPlayerId
    );

    public GamesService(NpgsqlDataSource ds, WordsService words)
    {
        _ds = ds;
        _words = words;
    }

    public async Task<CreateGameResponse> CreateGameAsync()
    {
        var gameId = Guid.NewGuid();
        var p1 = Guid.NewGuid();

        await using var conn = await _ds.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync(); // single tx for setup only
        try
        {
            var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = """
                insert into games (id, status, current_word, active_player_id, player1_id, player2_id, pending_claimer_id, pending_word, created_at, updated_at)
                values (@id, @status, '', @active, @p1, null, null, null, now(), now());
                insert into scores (game_id, player_id, score) values (@id, @p1, 0);
            """;
            cmd.Parameters.AddWithValue("id", gameId);
            cmd.Parameters.AddWithValue("status", GameStatus.WaitingForPlayers.ToString());
            cmd.Parameters.AddWithValue("active", p1);
            cmd.Parameters.AddWithValue("p1", p1);
            await cmd.ExecuteNonQueryAsync();

            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return new CreateGameResponse(gameId, p1);
    }

    public async Task<JoinGameResponse> JoinGameAsync(Guid gameId)
    {
        var p2 = Guid.NewGuid();

        await using var conn = await _ds.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        try
        {
            // lock row
            var read = conn.CreateCommand();
            read.Transaction = tx;
            read.CommandText = "select player2_id, status from games where id=@id for update";
            read.Parameters.AddWithValue("id", gameId);

            await using var r = await read.ExecuteReaderAsync();
            if (!await r.ReadAsync())
                throw new ApiException(404, "Game not found.");

            var existingP2 = r.IsDBNull(0) ? (Guid?)null : r.GetGuid(0);
            var status = r.GetString(1);

            if (existingP2 is not null)
                throw new ApiException(409, "Game already has two players.");

            if (!string.Equals(status, GameStatus.WaitingForPlayers.ToString(), StringComparison.OrdinalIgnoreCase))
                throw new ApiException(409, "Game is not joinable.");

            await r.CloseAsync();

            var update = conn.CreateCommand();
            update.Transaction = tx;
            update.CommandText = """
                update games
                set player2_id=@p2, status=@status, updated_at=now()
                where id=@id;
                insert into scores (game_id, player_id, score) values (@id, @p2, 0);
            """;
            update.Parameters.AddWithValue("id", gameId);
            update.Parameters.AddWithValue("p2", p2);
            update.Parameters.AddWithValue("status", GameStatus.InProgress.ToString());
            await update.ExecuteNonQueryAsync();

            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return new JoinGameResponse(gameId, p2);
    }

    public async Task<GameStateDto> GetStateAsync(Guid gameId)
    {
        await using var conn = await _ds.OpenConnectionAsync();

        var cmd = conn.CreateCommand();
        cmd.CommandText = """
            select g.id, g.status, g.current_word, g.active_player_id, g.last_letter_player_id, g.player1_id, g.player2_id, g.pending_claimer_id, g.pending_word,
                   coalesce(s1.score,0) as p1score,
                   coalesce(s2.score,0) as p2score
            from games g
            left join scores s1 on s1.game_id = g.id and s1.player_id = g.player1_id
            left join scores s2 on s2.game_id = g.id and s2.player_id = g.player2_id
            where g.id=@id
        """;
        cmd.Parameters.AddWithValue("id", gameId);

        await using var r = await cmd.ExecuteReaderAsync();
        if (!await r.ReadAsync())
            throw new ApiException(404, "Game not found.");

        var gameStateData = MapStateData(r);
        await r.CloseAsync();

        var wordHistory = await GetWordHistoryAsync(conn, gameId);
        return MapState(gameStateData, wordHistory);
    }

    public async Task<GameStateDto> PlayLetterAsync(Guid gameId, Guid playerToken, string letter)
    {
        var normalized = NormalizeLetter(letter);

        await using var conn = await _ds.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        try
        {
            var g = await ReadGameForUpdate(conn, tx, gameId);

            EnsurePlayerInGame(g, playerToken);
            if (g.Status != GameStatus.InProgress)
                throw new ApiException(409, "Game is not in progress.");
            if (g.ActivePlayerId != playerToken)
                throw new ApiException(409, "Not your turn.");

            var newWord = g.CurrentWord + normalized;

            // upsert contribution
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

            var next = OtherPlayer(g, playerToken);

            var upd = conn.CreateCommand();
            upd.Transaction = tx;
            upd.CommandText = """
                update games
                set current_word=@w, active_player_id=@next, last_letter_player_id=@last, updated_at=now()
                where id=@id
            """;
            upd.Parameters.AddWithValue("w", newWord);
            upd.Parameters.AddWithValue("next", next);
            upd.Parameters.AddWithValue("id", gameId);
            upd.Parameters.AddWithValue("last", playerToken);
            await upd.ExecuteNonQueryAsync();

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
            var g = await ReadGameForUpdate(conn, tx, gameId);

            EnsurePlayerInGame(g, playerToken);
            if (g.Status != GameStatus.InProgress)
                throw new ApiException(409, "Game is not in progress.");

            //if (g.ActivePlayerId != playerToken)
            //    throw new ApiException(409, "Not your turn.");

            var canClaim =
                g.ActivePlayerId == playerToken ||
                (g.LastLetterPlayerId.HasValue && g.LastLetterPlayerId.Value == playerToken);

            if (!canClaim)
                throw new ApiException(409, "You can only claim on your turn or immediately after placing the last letter.");

            if (g.CurrentWord.Length < MinLength)
                throw new ApiException(409, $"Word must be at least {MinLength} letters.");

            var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = """
                update games
                set status=@st, pending_claimer_id=@claimer, pending_word=@pw, updated_at=now()
                where id=@id
            """;
            cmd.Parameters.AddWithValue("st", GameStatus.PendingDispute.ToString());
            cmd.Parameters.AddWithValue("claimer", playerToken);
            cmd.Parameters.AddWithValue("pw", g.CurrentWord);
            cmd.Parameters.AddWithValue("id", gameId);
            await cmd.ExecuteNonQueryAsync();

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
            var g = await ReadGameForUpdate(conn, tx, gameId);

            if (g.Status != GameStatus.PendingDispute || g.PendingClaimerId is null || string.IsNullOrWhiteSpace(g.PendingWord))
                throw new ApiException(409, "No pending claim.");

            EnsurePlayerInGame(g, playerToken);

            var claimer = g.PendingClaimerId.Value;
            var opponent = OtherPlayer(g, claimer);
            if (playerToken != opponent)
                throw new ApiException(409, "Only the opponent may accept/dispute.");

            var basePoints = await GetContributionCount(conn, tx, gameId, claimer);
            var baseScore = basePoints * basePoints;

            // always check actual word validity so we can mark history correctly
            var wordValid = _words.IsValid(g.PendingWord!);

            int claimerDelta = 0;
            int opponentDelta = 0;

            if (!disputed)
            {
                claimerDelta = baseScore; // 100%
            }
            else
            {
                if (wordValid)
                    claimerDelta = (int)Math.Floor(baseScore * 1.5);
                else
                    opponentDelta = (int)Math.Floor(baseScore * 0.5);
            }

            if (claimerDelta != 0)
                await AddScore(conn, tx, gameId, claimer, claimerDelta);
            if (opponentDelta != 0)
                await AddScore(conn, tx, gameId, opponent, opponentDelta);

            // Store word history with points breakdown
            int p1Points = claimer == g.Player1Id ? claimerDelta : opponentDelta;
            int p2Points = claimer == g.Player2Id ? claimerDelta : opponentDelta;

            var history = conn.CreateCommand();
            history.Transaction = tx;
            history.CommandText = """
                insert into word_history (game_id, word, claimer_id, p1_points, p2_points, is_valid, created_at)
                values (@gid, @word, @claimer, @p1pts, @p2pts, @valid, now())
            """;
            history.Parameters.AddWithValue("gid", gameId);
            history.Parameters.AddWithValue("word", g.PendingWord!);
            history.Parameters.AddWithValue("claimer", claimer);
            history.Parameters.AddWithValue("p1pts", p1Points);
            history.Parameters.AddWithValue("p2pts", p2Points);
            history.Parameters.AddWithValue("valid", wordValid);
            await history.ExecuteNonQueryAsync();

            // reset word + contributions; turn goes to opponent of claimer (i.e. the resolver player)
            var reset = conn.CreateCommand();
            reset.Transaction = tx;
            reset.CommandText = """
                delete from contributions where game_id=@gid;
                update games
                set status=@st,
                    current_word='',
                    active_player_id=@next,
                    pending_claimer_id=null,
                    pending_word=null,
                    last_letter_player_id = null,
                    updated_at=now()
                where id=@gid
            """;
            reset.Parameters.AddWithValue("gid", gameId);
            reset.Parameters.AddWithValue("st", GameStatus.InProgress.ToString());
            reset.Parameters.AddWithValue("next", opponent);
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

    private static string NormalizeLetter(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            throw new ApiException(400, "Letter is required.");

        var s = input.Trim();

        // accept a single character, A-Z or ÅÄÖ
        if (s.Length != 1)
            throw new ApiException(400, "Letter must be exactly one character.");

        var c = char.ToUpperInvariant(s[0]);
        const string allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ";
        if (!allowed.Contains(c))
            throw new ApiException(400, "Letter must be A-Z (optionally ÅÄÖ).");

        return c.ToString();
    }

    private async Task<int> GetContributionCount(NpgsqlConnection conn, NpgsqlTransaction tx, Guid gameId, Guid playerId)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = "select coalesce(count,0) from contributions where game_id=@gid and player_id=@pid";
        cmd.Parameters.AddWithValue("gid", gameId);
        cmd.Parameters.AddWithValue("pid", playerId);
        var obj = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(obj);
    }

    private async Task AddScore(NpgsqlConnection conn, NpgsqlTransaction tx, Guid gameId, Guid playerId, int delta)
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
        var rows = await cmd.ExecuteNonQueryAsync();
        if (rows == 0)
            throw new ApiException(500, "Score row missing.");
    }

    private static void EnsurePlayerInGame(GameRow g, Guid playerToken)
    {
        if (playerToken != g.Player1Id && playerToken != g.Player2Id)
            throw new ApiException(401, "Player token is not part of this game.");
        if (g.Player2Id is null)
            throw new ApiException(409, "Waiting for second player.");
    }

    private static Guid OtherPlayer(GameRow g, Guid playerId)
    {
        if (g.Player2Id is null)
            throw new ApiException(409, "Waiting for second player.");
        return playerId == g.Player1Id ? g.Player2Id.Value : g.Player1Id;
    }

    private async Task<GameRow> ReadGameForUpdate(NpgsqlConnection conn, NpgsqlTransaction tx, Guid gameId)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            select id, status, current_word, active_player_id, player1_id, player2_id, pending_claimer_id, pending_word, last_letter_player_id
            from games
            where id=@id
            for update
        """;
        cmd.Parameters.AddWithValue("id", gameId);

        await using var r = await cmd.ExecuteReaderAsync();
        if (!await r.ReadAsync())
            throw new ApiException(404, "Game not found.");

        return new GameRow(
            r.GetGuid(0),
            Enum.Parse<GameStatus>(r.GetString(1)),
            r.GetString(2),
            r.GetGuid(3),
            r.GetGuid(4),
            r.IsDBNull(5) ? (Guid?)null : r.GetGuid(5),
            r.IsDBNull(6) ? (Guid?)null : r.GetGuid(6),
            r.IsDBNull(7) ? null : r.GetString(7),
            r.IsDBNull(8) ? (Guid?)null : r.GetGuid(8)
        );
    }

    private async Task<List<WordHistoryEntry>> GetWordHistoryAsync(NpgsqlConnection conn, Guid gameId)
    {
        var cmd = conn.CreateCommand();
        cmd.CommandText = "select word, claimer_id, p1_points, p2_points, is_valid from word_history where game_id=@gid order by created_at asc";
        cmd.Parameters.AddWithValue("gid", gameId);

        var history = new List<WordHistoryEntry>();
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync())
        {
            history.Add(new WordHistoryEntry(
                r.GetString(0),
                r.GetGuid(1),
                r.GetInt32(2),
                r.GetInt32(3),
                r.GetBoolean(4)
            ));
        }
        return history;
    }

    private sealed record GameStateData(
        Guid GameId,
        GameStatus Status,
        string CurrentWord,
        Guid ActivePlayerId,
        Guid? LastLetterPlayerId,
        Guid Player1Id,
        Guid? Player2Id,
        Guid? PendingClaimerId,
        string? PendingWord,
        int Player1Score,
        int Player2Score
    );

    private static GameStateData MapStateData(NpgsqlDataReader r)
    {
        return new GameStateData(
            r.GetGuid(0),
            Enum.Parse<GameStatus>(r.GetString(1)),
            r.GetString(2),
            r.GetGuid(3),
            r.IsDBNull(4) ? (Guid?)null : r.GetGuid(4),
            r.GetGuid(5),
            r.IsDBNull(6) ? (Guid?)null : r.GetGuid(6),
            r.IsDBNull(7) ? (Guid?)null : r.GetGuid(7),
            r.IsDBNull(8) ? null : r.GetString(8),
            r.GetInt32(9),
            r.GetInt32(10)
        );
    }

    private static GameStateDto MapState(GameStateData data, List<WordHistoryEntry> wordHistory)
    {
        return new GameStateDto(
            data.GameId,
            data.Status,
            data.CurrentWord,
            data.ActivePlayerId,
            data.LastLetterPlayerId,
            data.Player1Id,
            data.Player2Id,
            data.Player1Score,
            data.Player2Score,
            data.PendingClaimerId,
            data.PendingWord,
            wordHistory
        );
    }
}
