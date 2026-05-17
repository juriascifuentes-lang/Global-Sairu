-- ═══════════════════════════════════════════════════════════════
--  Trading Journal – Tablas principales + RLS
--  Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
--  1. PROFILES
-- ─────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  is_approved boolean     not null default false,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_owner" on public.profiles;
create policy "profiles_owner" on public.profiles
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────
--  2. ACCOUNTS
-- ─────────────────────────────────────────
create table if not exists public.accounts (
  id               bigserial    primary key,
  user_id          uuid         not null references auth.users(id) on delete cascade,
  name             text         not null,
  capital_type     text         not null default 'Empresa de Fondeo CFDS',
  size             text,
  cost             text,
  id_number        text,
  broker           text,
  broker_custom    text,
  notes            text,
  status           text         not null default 'Activa',
  phase            text,
  master_account_id bigint      references public.accounts(id) on delete set null,
  copy_ratio       numeric      not null default 1.0,
  created_at       timestamptz  not null default now()
);

alter table public.accounts enable row level security;

drop policy if exists "accounts_select" on public.accounts;
create policy "accounts_select" on public.accounts
  for select using (auth.uid() = user_id);

drop policy if exists "accounts_insert" on public.accounts;
create policy "accounts_insert" on public.accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists "accounts_update" on public.accounts;
create policy "accounts_update" on public.accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "accounts_delete" on public.accounts;
create policy "accounts_delete" on public.accounts
  for delete using (auth.uid() = user_id);

create index if not exists idx_accounts_user on public.accounts(user_id);

-- ─────────────────────────────────────────
--  3. TRADES
-- ─────────────────────────────────────────
create table if not exists public.trades (
  id              bigserial    primary key,
  user_id         uuid         not null references auth.users(id) on delete cascade,
  symbol          text         not null,
  type            text         not null,
  profit          numeric      not null default 0,
  note            text,
  date            text,
  open_time       text,
  strategy        text,
  account         text,
  setup_quality   text,
  psychology      text,
  images          jsonb        not null default '[]',
  entry_note      text,
  entry_images    jsonb        not null default '[]',
  stop_loss       numeric,
  take_profit     numeric,
  copied_from_id  bigint       references public.trades(id) on delete set null,
  created_at      timestamptz  not null default now()
);

alter table public.trades enable row level security;

drop policy if exists "trades_select" on public.trades;
create policy "trades_select" on public.trades
  for select using (auth.uid() = user_id);

drop policy if exists "trades_insert" on public.trades;
create policy "trades_insert" on public.trades
  for insert with check (auth.uid() = user_id);

drop policy if exists "trades_update" on public.trades;
create policy "trades_update" on public.trades
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "trades_delete" on public.trades;
create policy "trades_delete" on public.trades
  for delete using (auth.uid() = user_id);

create index if not exists idx_trades_user    on public.trades(user_id);
create index if not exists idx_trades_account on public.trades(account);
create index if not exists idx_trades_date    on public.trades(date);

-- ─────────────────────────────────────────
--  4. WITHDRAWALS
-- ─────────────────────────────────────────
create table if not exists public.withdrawals (
  id         bigserial    primary key,
  user_id    uuid         not null references auth.users(id) on delete cascade,
  account    text         not null,
  amount     numeric      not null default 0,
  date       text,
  notes      text,
  created_at timestamptz  not null default now()
);

alter table public.withdrawals enable row level security;

drop policy if exists "withdrawals_select" on public.withdrawals;
create policy "withdrawals_select" on public.withdrawals
  for select using (auth.uid() = user_id);

drop policy if exists "withdrawals_insert" on public.withdrawals;
create policy "withdrawals_insert" on public.withdrawals
  for insert with check (auth.uid() = user_id);

drop policy if exists "withdrawals_update" on public.withdrawals;
create policy "withdrawals_update" on public.withdrawals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "withdrawals_delete" on public.withdrawals;
create policy "withdrawals_delete" on public.withdrawals
  for delete using (auth.uid() = user_id);

create index if not exists idx_withdrawals_user on public.withdrawals(user_id);

-- ─────────────────────────────────────────
--  5. STRATEGIES
-- ─────────────────────────────────────────
create table if not exists public.strategies (
  id          bigserial    primary key,
  user_id     uuid         not null references auth.users(id) on delete cascade,
  name        text         not null,
  description text,
  rules       jsonb        not null default '[]',
  created_at  timestamptz  not null default now()
);

alter table public.strategies enable row level security;

drop policy if exists "strategies_select" on public.strategies;
create policy "strategies_select" on public.strategies
  for select using (auth.uid() = user_id);

drop policy if exists "strategies_insert" on public.strategies;
create policy "strategies_insert" on public.strategies
  for insert with check (auth.uid() = user_id);

drop policy if exists "strategies_update" on public.strategies;
create policy "strategies_update" on public.strategies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "strategies_delete" on public.strategies;
create policy "strategies_delete" on public.strategies
  for delete using (auth.uid() = user_id);

create index if not exists idx_strategies_user on public.strategies(user_id);

-- ─────────────────────────────────────────
--  6. STORAGE – bucket trade-images
-- ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('trade-images', 'trade-images', false)
on conflict (id) do nothing;

drop policy if exists "trade_images_select" on storage.objects;
create policy "trade_images_select" on storage.objects
  for select using (bucket_id = 'trade-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "trade_images_insert" on storage.objects;
create policy "trade_images_insert" on storage.objects
  for insert with check (bucket_id = 'trade-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "trade_images_delete" on storage.objects;
create policy "trade_images_delete" on storage.objects
  for delete using (bucket_id = 'trade-images' and auth.uid()::text = (storage.foldername(name))[1]);
