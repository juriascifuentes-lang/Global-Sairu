-- Tabla para contabilidad personal de gastos operativos de trading
CREATE TABLE IF NOT EXISTS accounting_entries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  amount       NUMERIC     NOT NULL CHECK (amount >= 0),
  category     TEXT        NOT NULL DEFAULT 'Otros',
  entry_date   DATE        NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_owns_accounting_entries"
  ON accounting_entries
  FOR ALL
  USING (auth.uid() = user_id);
