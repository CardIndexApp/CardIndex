-- ─────────────────────────────────────────────
-- CardIndex database schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────

-- Profiles (auto-created on signup via trigger)
create table if not exists public.profiles (
  id            uuid references auth.users on delete cascade primary key,
  email         text,
  username      text unique,
  tier          text not null default 'free',   -- 'free' | 'standard' | 'pro'
  stripe_customer_id      text,
  stripe_subscription_id  text,
  subscription_status     text,
  created_at    timestamptz default now()
);

-- Trigger: create profile on new user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, username)
  values (new.id, new.email, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Watchlists (one row per card per user per grade)
create table if not exists public.watchlists (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  card_id     text not null,          -- pokemontcg.io card ID  e.g. "swsh7-215"
  card_name   text not null,
  set_name    text,
  grade       text not null,          -- 'PSA 10', 'Raw', etc.
  image_url   text,
  alert_price numeric,
  notes       text,
  added_at    timestamptz default now(),
  unique (user_id, card_id, grade)
);


-- Search / price cache (deduplication table)
create table if not exists public.search_cache (
  cache_key     text primary key,       -- "{card_id}:{grade}"
  card_id       text not null,
  card_name     text not null,
  set_name      text,
  grade         text not null,
  image_url     text,
  price         numeric,
  price_change_pct  numeric,
  price_range_low   numeric,
  price_range_high  numeric,
  price_history     jsonb default '[]',   -- [{month,price}, ...]
  ebay_listings     jsonb default '[]',   -- [{title,price,date,url}, ...]
  score             integer,
  score_breakdown   jsonb,
  sales_count_30d   integer,
  last_fetched      timestamptz default now(),
  -- Poketrace extras
  poketrace_id      text,
  currency          text,
  market            text,
  avg7d             numeric,
  avg30d            numeric
);


-- Search log (powers "Popular right now" + analytics)
create table if not exists public.search_log (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  card_id     text,
  card_name   text,
  grade       text,
  searched_at timestamptz default now()
);


-- ── Additional tables ───────────────────────────────

-- Portfolios (one row per card position per user)
create table if not exists public.portfolios (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references public.profiles(id) on delete cascade not null,
  card_id        text not null,
  card_name      text not null,
  set_name       text,
  grade          text not null,
  card_number    text,
  image_url      text,
  purchase_price numeric not null check (purchase_price > 0),
  quantity       integer not null default 1 check (quantity >= 1 and quantity <= 9999),
  purchased_at   date,
  added_at       timestamptz default now(),
  notes          text check (char_length(notes) <= 2000)
);

-- Upgrade requests (manual tier upgrade queue)
create table if not exists public.upgrade_requests (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references public.profiles(id) on delete cascade not null,
  requested_tier text not null,
  requested_at   timestamptz default now(),
  actioned_at    timestamptz,
  actioned_by    uuid references public.profiles(id) on delete set null,
  action         text check (action in ('approve','deny'))
);


-- CI-100 market index constituents (admin-managed curated card list)
create table if not exists public.market_constituents (
  id          uuid default gen_random_uuid() primary key,
  card_id     text not null,           -- pokemontcg.io card ID e.g. "base1-4"
  grade       text not null,           -- 'PSA 10', 'Raw', etc.
  card_name   text not null,
  set_name    text,
  image_url   text,
  added_at    timestamptz default now(),
  unique (card_id, grade)
);
-- No RLS — access only via service-role key in admin API routes.

-- ── Row Level Security ──────────────────────────────

alter table public.profiles        enable row level security;
alter table public.watchlists      enable row level security;
alter table public.search_log      enable row level security;
alter table public.portfolios      enable row level security;
alter table public.upgrade_requests enable row level security;
-- search_cache: no direct client access — all reads/writes go through
-- server-side API routes using the service-role key (bypasses RLS intentionally).
-- Client-side Supabase client has no SELECT policy, so rows are invisible to browsers.

-- Profiles: users can only see/edit their own
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Watchlists: full CRUD for owner only
create policy "watchlist_select_own" on public.watchlists
  for select using (auth.uid() = user_id);
create policy "watchlist_insert_own" on public.watchlists
  for insert with check (auth.uid() = user_id);
create policy "watchlist_update_own" on public.watchlists
  for update using (auth.uid() = user_id);
create policy "watchlist_delete_own" on public.watchlists
  for delete using (auth.uid() = user_id);

-- Portfolios: full CRUD for owner only
create policy "portfolio_select_own" on public.portfolios
  for select using (auth.uid() = user_id);
create policy "portfolio_insert_own" on public.portfolios
  for insert with check (auth.uid() = user_id);
create policy "portfolio_update_own" on public.portfolios
  for update using (auth.uid() = user_id);
create policy "portfolio_delete_own" on public.portfolios
  for delete using (auth.uid() = user_id);

-- Upgrade requests: users can insert and view their own; only admins can update
create policy "upgrade_request_insert_own" on public.upgrade_requests
  for insert with check (auth.uid() = user_id);
create policy "upgrade_request_select_own" on public.upgrade_requests
  for select using (auth.uid() = user_id);
-- UPDATE (actioning) is done exclusively via the service-role key in admin API routes

-- Search log: users can insert (for logged queries)
create policy "search_log_insert" on public.search_log
  for insert with check (auth.uid() = user_id or user_id is null);
create policy "search_log_select_own" on public.search_log
  for select using (auth.uid() = user_id);
