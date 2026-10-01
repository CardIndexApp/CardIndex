-- Run in Supabase SQL Editor to enable search re-engagement notifications.
alter table public.profiles
  add column if not exists last_search_card_id   text,
  add column if not exists last_search_card_name text,
  add column if not exists last_search_grade     text,
  add column if not exists last_search_price_usd numeric,
  add column if not exists last_search_at        timestamptz;

create index if not exists profiles_last_search_at_idx
  on public.profiles (last_search_at)
  where last_search_at is not null;
