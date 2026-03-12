using Npgsql;

namespace EverySecondLetter.Services;

public static class SeedDb
{
  public static async Task InitializeAsync(NpgsqlDataSource ds)
  {
    await using var conn = await ds.OpenConnectionAsync();

    // Check if tables exist
    var tablesExist = await TablesExistAsync(conn);

    if (!tablesExist)
    {
      await CreateTablesAsync(conn);
      Console.WriteLine("✓ Database tables created");
    }
    else
    {
      Console.WriteLine("✓ Database tables already exist");
    }
  }

  private static async Task<bool> TablesExistAsync(NpgsqlConnection conn)
  {
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = """
            select exists (
              select 1 from information_schema.tables 
              where table_schema = 'public' 
              and table_name = 'games'
            )
        """;

    var result = await cmd.ExecuteScalarAsync();
    return result is not null && (bool)result;
  }

  private static async Task CreateTablesAsync(NpgsqlConnection conn)
  {
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = """
            create table if not exists games (
              id uuid primary key,
              status text not null,
              current_word text not null default '',
              active_player_id uuid not null,
              player1_id uuid not null,
              player2_id uuid null,
              pending_claimer_id uuid null,
              pending_word text null,
              created_at timestamptz not null,
              updated_at timestamptz not null,
              last_letter_player_id uuid null
            );

            create table if not exists scores (
              game_id uuid not null references games(id) on delete cascade,
              player_id uuid not null,
              score int not null default 0,
              primary key (game_id, player_id)
            );

            create table if not exists contributions (
              game_id uuid not null references games(id) on delete cascade,
              player_id uuid not null,
              count int not null,
              primary key (game_id, player_id)
            );

            create index if not exists idx_games_updated_at on games(updated_at desc);
        """;

    await cmd.ExecuteNonQueryAsync();
  }
}
