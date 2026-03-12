-- Run this once against your Postgres database.
-- Example: psql "$DATABASE_URL" -f sql/001_init.sql

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

create table if not exists word_history (
  game_id uuid not null references games(id) on delete cascade,
  word text not null,
  claimer_id uuid not null,
  p1_points int not null default 0,
  p2_points int not null default 0,
  is_valid boolean not null,
  created_at timestamptz not null
);

create index if not exists idx_games_updated_at on games(updated_at desc);
