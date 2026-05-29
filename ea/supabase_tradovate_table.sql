-- Tradovate OAuth connections — una fila por usuario
CREATE TABLE IF NOT EXISTS tradovate_connections (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token       TEXT        NOT NULL,
  refresh_token      TEXT,
  token_expires_at   TIMESTAMPTZ,
  -- Array JSON de cuentas Tradovate: [{id, name, active}]
  tradovate_accounts JSONB       NOT NULL DEFAULT '[]',
  last_sync_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE tradovate_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_owns_connection"
  ON tradovate_connections
  FOR ALL
  USING (auth.uid() = user_id);
