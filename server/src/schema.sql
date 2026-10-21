CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  username        TEXT NOT NULL,
  display_name    TEXT,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  stars           INTEGER NOT NULL DEFAULT 0 CHECK (stars >= 0),
  avatar          TEXT NOT NULL DEFAULT 'orange',
  last_daily_bonus DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));

-- Libro contable: cada movimiento de estrellitas queda registrado
CREATE TABLE IF NOT EXISTS transactions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  kind          TEXT NOT NULL,
  description   TEXT NOT NULL,
  game          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions (user_id, created_at DESC);

-- Resultado final de cada partida
CREATE TABLE IF NOT EXISTS game_results (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game       TEXT NOT NULL,
  bet        INTEGER NOT NULL,
  payout     INTEGER NOT NULL,
  outcome    TEXT NOT NULL CHECK (outcome IN ('win', 'lose', 'push')),
  summary    TEXT NOT NULL,
  details    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_results_user_idx ON game_results (user_id, created_at DESC);

-- Partidas en curso (blackjack, mayor o menor, solitario, carrera)
CREATE TABLE IF NOT EXISTS game_sessions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  bet        INTEGER NOT NULL DEFAULT 0,
  state      JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_one_active_idx
  ON game_sessions (user_id, game) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS rewards (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cost        INTEGER NOT NULL CHECK (cost > 0),
  icon        TEXT NOT NULL DEFAULT '💋',
  stock       INTEGER CHECK (stock IS NULL OR stock >= 0),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS redemptions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id    INTEGER REFERENCES rewards(id) ON DELETE SET NULL,
  reward_title TEXT NOT NULL,
  reward_icon  TEXT NOT NULL DEFAULT '🎁',
  cost         INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  note         TEXT,
  admin_note   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS redemptions_user_idx ON redemptions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
