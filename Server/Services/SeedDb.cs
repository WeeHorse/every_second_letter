using System.Data.Common;
using EverySecondLetter.Services.Database;

namespace EverySecondLetter.Services;

public static class SeedDb
{
  public static async Task InitializeAsync(IDbConnectionFactory connections, DbProvider provider)
  {
    await using var conn = await connections.OpenConnectionAsync();

    var tablesExist = await TablesExistAsync(conn, provider);

    if (!tablesExist)
    {
      await CreateTablesAsync(conn, provider);
      Console.WriteLine("Database tables created");
    }
    else
    {
      Console.WriteLine("Database tables already exist");
      await EnsureSchemaAsync(conn, provider);
    }
  }

  private static async Task<bool> TablesExistAsync(DbConnection conn, DbProvider provider)
  {
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = provider == DbProvider.Postgres
        ? """
                select exists (
                  select 1 from information_schema.tables
                  where table_schema = 'public'
                  and table_name = 'games'
                )
              """
        : "select exists(select 1 from sqlite_master where type = 'table' and name = 'games')";

    var result = await cmd.ExecuteScalarAsync();
    return result switch
    {
      bool b => b,
      long l => l != 0,
      int i => i != 0,
      _ => result is not null && Convert.ToBoolean(result)
    };
  }

  private static async Task EnsureSchemaAsync(DbConnection conn, DbProvider provider)
  {
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = provider == DbProvider.Postgres ? PostgresEnsureSchemaSql : SqliteEnsureSchemaSql;
    await cmd.ExecuteNonQueryAsync();
  }

  private static async Task CreateTablesAsync(DbConnection conn, DbProvider provider)
  {
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = provider == DbProvider.Postgres ? PostgresCreateTablesSql : SqliteCreateTablesSql;
    await cmd.ExecuteNonQueryAsync();
  }

  private const string PostgresEnsureSchemaSql = """
        create table if not exists word_history (
          id uuid,
          game_id uuid not null references games(id) on delete cascade,
          word text not null,
          claimer_id uuid not null,
          is_valid boolean not null,
          created_at timestamptz not null
        );

        alter table word_history
          add column if not exists id uuid,
          add column if not exists points_json jsonb not null default '[]'::jsonb;

        create table if not exists game_players (
          game_id uuid not null references games(id) on delete cascade,
          player_id uuid not null,
          player_name text not null default '',
          turn_order int not null,
          score int not null default 0,
          accepts_left int not null default 5,
          disputes_left int not null default 5,
          joined_at timestamptz not null,
          primary key (game_id, player_id),
          unique (game_id, turn_order)
        );

        alter table game_players
          add column if not exists player_name text not null default '';
    """;

  private const string PostgresCreateTablesSql = """
        create table if not exists games (
          id uuid primary key,
          status text not null,
          current_word text not null default '',
          active_player_id uuid not null,
          pending_claimer_id uuid null,
          pending_word text null,
          created_at timestamptz not null,
          updated_at timestamptz not null,
          last_letter_player_id uuid null
        );

        create table if not exists contributions (
          game_id uuid not null references games(id) on delete cascade,
          player_id uuid not null,
          count int not null,
          primary key (game_id, player_id)
        );

        create table if not exists word_history (
          id uuid,
          game_id uuid not null references games(id) on delete cascade,
          word text not null,
          claimer_id uuid not null,
          is_valid boolean not null,
          created_at timestamptz not null
        );

        alter table word_history
          add column if not exists points_json jsonb not null default '[]'::jsonb;

        create table if not exists game_players (
          game_id uuid not null references games(id) on delete cascade,
          player_id uuid not null,
          player_name text not null default '',
          turn_order int not null,
          score int not null default 0,
          accepts_left int not null default 5,
          disputes_left int not null default 5,
          joined_at timestamptz not null,
          primary key (game_id, player_id),
          unique (game_id, turn_order)
        );

        alter table game_players
          add column if not exists player_name text not null default '';

        create index if not exists idx_games_updated_at on games(updated_at desc);
    """;

  private const string SqliteEnsureSchemaSql = """
        create table if not exists games (
          id text primary key,
          status text not null,
          current_word text not null default '',
          active_player_id text not null,
          pending_claimer_id text null,
          pending_word text null,
          created_at text not null default CURRENT_TIMESTAMP,
          updated_at text not null default CURRENT_TIMESTAMP,
          last_letter_player_id text null
        );

        create table if not exists contributions (
          game_id text not null references games(id) on delete cascade,
          player_id text not null,
          count integer not null,
          primary key (game_id, player_id)
        );

        create table if not exists word_history (
          id text primary key,
          game_id text not null references games(id) on delete cascade,
          word text not null,
          claimer_id text not null,
          is_valid integer not null,
          created_at text not null default CURRENT_TIMESTAMP,
          points_json text not null default '[]'
        );

        create table if not exists game_players (
          game_id text not null references games(id) on delete cascade,
          player_id text not null,
          player_name text not null default '',
          turn_order integer not null,
          score integer not null default 0,
          accepts_left integer not null default 5,
          disputes_left integer not null default 5,
          joined_at text not null default CURRENT_TIMESTAMP,
          primary key (game_id, player_id),
          unique (game_id, turn_order)
        );

        create index if not exists idx_games_updated_at on games(updated_at desc);
    """;

  private const string SqliteCreateTablesSql = SqliteEnsureSchemaSql;
}
