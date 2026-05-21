-- ═══════════════════════════════════════════════════════════════
--  Trading Journal – Tablas de REVISIÓN + RLS
--  Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
--  1. REVIEW_ACCOUNTS
-- ─────────────────────────────────────────
create table if not exists public.review_accounts (
  id            bigserial    primary key,
  user_id       uuid         not null references auth.users(id) on delete cascade,
  name          text         not null,
  capital_type  text         not null default 'Empresa de Fondeo CFDS',
  size          text,
  cost          text,
  id_number     text,
  broker        text,
  broker_custom text,
  notes         text,
  status        text         not null default 'Activa',
  phase         text,
  created_at    timestamptz  not null default now()
);

alter table public.review_accounts enable row level security;

drop policy if exists "review_accounts_select" on public.review_accounts;
create policy "review_accounts_select" on public.review_accounts
  for select using (auth.uid() = user_id);

drop policy if exists "review_accounts_insert" on public.review_accounts;
create policy "review_accounts_insert" on public.review_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists "review_accounts_update" on public.review_accounts;
create policy "review_accounts_update" on public.review_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "review_accounts_delete" on public.review_accounts;
create policy "review_accounts_delete" on public.review_accounts
  for delete using (auth.uid() = user_id);

create index if not exists idx_review_accounts_user on public.review_accounts(user_id);

-- ─────────────────────────────────────────
--  2. REVIEW_TRADES
-- ─────────────────────────────────────────
create table if not exists public.review_trades (
  id            bigserial    primary key,
  user_id       uuid         not null references auth.users(id) on delete cascade,
  symbol        text         not null,
  type          text         not null,
  profit        numeric      not null default 0,
  note          text,
  date          text,
  open_time     text,
  strategy      text,
  account       text,
  setup_quality text,
  psychology    text,
  images        jsonb        not null default '[]',
  entry_note    text,
  entry_images  jsonb        not null default '[]',
  stop_loss     numeric,
  take_profit   numeric,
  max_rr        numeric,
  created_at    timestamptz  not null default now()
);

alter table public.review_trades enable row level security;

drop policy if exists "review_trades_select" on public.review_trades;
create policy "review_trades_select" on public.review_trades
  for select using (auth.uid() = user_id);

drop policy if exists "review_trades_insert" on public.review_trades;
create policy "review_trades_insert" on public.review_trades
  for insert with check (auth.uid() = user_id);

drop policy if exists "review_trades_update" on public.review_trades;
create policy "review_trades_update" on public.review_trades
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "review_trades_delete" on public.review_trades;
create policy "review_trades_delete" on public.review_trades
  for delete using (auth.uid() = user_id);

create index if not exists idx_review_trades_user    on public.review_trades(user_id);
create index if not exists idx_review_trades_account on public.review_trades(account);
create index if not exists idx_review_trades_date    on public.review_trades(date);

-- ─────────────────────────────────────────
--  3. REVIEW_STRATEGIES
-- ─────────────────────────────────────────
create table if not exists public.review_strategies (
  id          bigserial    primary key,
  user_id     uuid         not null references auth.users(id) on delete cascade,
  name        text         not null,
  description text,
  rules       jsonb        not null default '[]',
  created_at  timestamptz  not null default now()
);

alter table public.review_strategies enable row level security;

drop policy if exists "review_strategies_select" on public.review_strategies;
create policy "review_strategies_select" on public.review_strategies
  for select using (auth.uid() = user_id);

drop policy if exists "review_strategies_insert" on public.review_strategies;
create policy "review_strategies_insert" on public.review_strategies
  for insert with check (auth.uid() = user_id);

drop policy if exists "review_strategies_update" on public.review_strategies;
create policy "review_strategies_update" on public.review_strategies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "review_strategies_delete" on public.review_strategies;
create policy "review_strategies_delete" on public.review_strategies
  for delete using (auth.uid() = user_id);

create index if not exists idx_review_strategies_user on public.review_strategies(user_id);

-- ═══════════════════════════════════════════════════════════════
--  CORRECCIÓN: Agregar columnas faltantes si ya existe la tabla
--  (ejecuta esto si ya creaste review_trades antes)
-- ═══════════════════════════════════════════════════════════════
alter table public.review_trades add column if not exists images       jsonb not null default '[]';
alter table public.review_trades add column if not exists entry_images jsonb not null default '[]';
alter table public.review_trades add column if not exists max_rr       numeric;
