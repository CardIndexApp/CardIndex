-- Run this in the Supabase SQL Editor to enable portfolio milestones.
-- Also adds the milestones column to notification_preferences.

alter table public.notification_preferences
  add column if not exists milestones boolean not null default true;


create table if not exists public.portfolio_milestones (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- e.g. "value_1000", "card_doubled:abc123:PSA 10"
  milestone_key   text not null,
  achieved_at     timestamptz not null default now(),
  acknowledged_at timestamptz,
  pushed_at       timestamptz,
  -- extra context shown in the celebration (current value, card name, etc.)
  payload         jsonb,
  constraint portfolio_milestones_uniq unique (user_id, milestone_key)
);

alter table public.portfolio_milestones enable row level security;

create policy "milestones_select_own" on public.portfolio_milestones
  for select using (auth.uid() = user_id);

create policy "milestones_update_own" on public.portfolio_milestones
  for update using (auth.uid() = user_id);
