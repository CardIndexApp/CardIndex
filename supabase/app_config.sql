-- Run in Supabase SQL Editor to enable in-app update prompts.
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

-- Row-level security: anyone can read, only service role can write.
alter table public.app_config enable row level security;

create policy "app_config read-only for all"
  on public.app_config for select
  using (true);

-- Seed the initial values (update these whenever you ship a new version).
insert into public.app_config (key, value)
values
  ('ios_min_version',    '2.1'),   -- below this = force update, non-dismissible
  ('ios_latest_version', '2.1'),   -- below this = soft nudge banner
  ('ios_app_store_url',  'https://apps.apple.com/app/id6742997207')
on conflict (key) do nothing;
