-- Run in Supabase SQL Editor to enable welcome email tracking.
alter table public.profiles
  add column if not exists welcome_email_sent boolean not null default false;
