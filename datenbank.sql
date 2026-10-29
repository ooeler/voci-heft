-- Voci-Heft: Tabellen und Zugriffsregeln.
-- In Supabase unter "SQL Editor" einfügen und auf "Run" klicken.

create table if not exists public.lists (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null default '',
  lang       text not null default 'en-GB',
  words      jsonb not null default '[]'::jsonb,
  points     integer not null default 0,
  best       integer not null default 0,
  updated_at timestamptz not null default now()
);
-- Falls die Tabelle schon von einer früheren Version existiert:
alter table public.lists add column if not exists points integer not null default 0;
alter table public.lists add column if not exists best integer not null default 0;

create index if not exists lists_user_id_idx on public.lists (user_id);

create table if not exists public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  xp         integer not null default 0,
  stats      jsonb not null default '{}'::jsonb,
  badges     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Jedes Konto sieht und ändert nur seine eigenen Daten.
alter table public.lists enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "eigene Listen lesen" on public.lists;
drop policy if exists "eigene Listen anlegen" on public.lists;
drop policy if exists "eigene Listen ändern" on public.lists;
drop policy if exists "eigene Listen löschen" on public.lists;
create policy "eigene Listen lesen"   on public.lists for select to authenticated using ((select auth.uid()) = user_id);
create policy "eigene Listen anlegen" on public.lists for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "eigene Listen ändern"  on public.lists for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "eigene Listen löschen" on public.lists for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "eigenes Profil lesen" on public.profiles;
drop policy if exists "eigenes Profil anlegen" on public.profiles;
drop policy if exists "eigenes Profil ändern" on public.profiles;
create policy "eigenes Profil lesen"   on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "eigenes Profil anlegen" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "eigenes Profil ändern"  on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
