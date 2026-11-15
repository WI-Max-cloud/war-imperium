-- Einmal im SQL Editor des eigenen Supabase-Projekts ausführen.
create table if not exists public.war_imperium_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.war_imperium_state enable row level security;
revoke all on public.war_imperium_state from anon, authenticated;
grant select, insert, update on public.war_imperium_state to service_role;
-- Kein öffentlicher Browserzugriff: ausschließlich das Backend nutzt einen Secret-Key.
