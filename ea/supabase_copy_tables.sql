-- ═══════════════════════════════════════════════════════════════
--  GlobalSairu Copy Trading – Tablas Supabase
--  Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- 1. Copiadores configurados desde el panel web
create table if not exists public.copy_copiers (
  id             bigserial primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  master_name    text        not null,
  slave_name     text        not null,
  slave_number   text,
  risk_type      text        not null default 'multiplier',  -- multiplier | balance_ratio | fixed_lots
  multiplier     numeric     not null default 1.0,
  symbol_suffix  text        not null default '',
  copy_existing  boolean     not null default false,
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now()
);

-- 2. Señales enviadas por el EA Maestro
create table if not exists public.copy_signals (
  id             bigserial primary key,
  master_name    text        not null,
  signal_type    text        not null,  -- OPEN | CLOSE | MODIFY
  master_ticket  bigint      not null,
  symbol         text        not null,
  direction      text        not null,  -- BUY | SELL
  lots           numeric     not null,
  open_price     numeric     not null default 0,
  sl             numeric     not null default 0,
  tp             numeric     not null default 0,
  processed      boolean     not null default false,
  slave_name     text,
  exec_ticket    bigint,
  exec_comment   text,
  slave_balance  numeric,
  created_at     timestamptz not null default now()
);

-- 3. RLS – copy_copiers: solo el dueño lee/escribe
alter table public.copy_copiers enable row level security;

drop policy if exists "owner_copiers" on public.copy_copiers;
create policy "owner_copiers" on public.copy_copiers
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. RLS – copy_signals: abierto para el anon key (EAs no autenticados)
alter table public.copy_signals enable row level security;

-- EA Maestro puede insertar
drop policy if exists "ea_insert_signals" on public.copy_signals;
create policy "ea_insert_signals" on public.copy_signals
  for insert to anon
  with check (true);

-- EA Esclavo puede leer no procesados
drop policy if exists "ea_read_signals" on public.copy_signals;
create policy "ea_read_signals" on public.copy_signals
  for select to anon
  using (true);

-- EA Esclavo puede marcar como procesado
drop policy if exists "ea_update_signals" on public.copy_signals;
create policy "ea_update_signals" on public.copy_signals
  for update to anon
  using (true)
  with check (true);

-- 5. Columna master_balance (balance de la maestra al momento de la señal)
alter table public.copy_signals
  add column if not exists master_balance numeric not null default 0;

-- 6. Índices de rendimiento
create index if not exists idx_copy_signals_master_name  on public.copy_signals(master_name);
create index if not exists idx_copy_signals_processed     on public.copy_signals(processed);
create index if not exists idx_copy_copiers_user          on public.copy_copiers(user_id);
