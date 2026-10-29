-- Voci-Heft: Tabellen und Zugriffsregeln.
-- In Supabase unter "SQL Editor" einfügen und auf "Run" klicken.
-- Die Datei darf mehrmals ausgeführt werden; bestehende Daten bleiben erhalten.

create table if not exists public.lists (
  id         text not null,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null default '',
  lang       text not null default '',
  words      jsonb not null default '[]'::jsonb,
  points     integer not null default 0,
  best       integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
-- Falls die Tabelle schon von einer früheren Version existiert:
alter table public.lists add column if not exists points integer not null default 0;
alter table public.lists add column if not exists best integer not null default 0;
-- Früher war "id" allein der Schlüssel. Jetzt gehört jede Listen-ID zu einem Konto,
-- damit niemand die IDs anderer Konten besetzen kann.
do $$ begin
  if (select array_length(conkey, 1) from pg_constraint
      where conrelid = 'public.lists'::regclass and contype = 'p') = 1 then
    alter table public.lists drop constraint lists_pkey;
    alter table public.lists add primary key (user_id, id);
  end if;
end $$;
drop index if exists public.lists_user_id_idx;

create table if not exists public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  xp         integer not null default 0,
  stats      jsonb not null default '{}'::jsonb,
  badges     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Grenzen gegen kaputte oder riesige Daten. Die App hält dieselben Grenzen ein.
alter table public.lists drop constraint if exists lists_grenzen;
alter table public.lists add constraint lists_grenzen check (
  id ~ '^[A-Za-z0-9_-]{1,64}$'
  and char_length(name) <= 120
  and char_length(lang) <= 10
  and jsonb_typeof(words) = 'array'
  and jsonb_array_length(words) <= 1000
  and pg_column_size(words) <= 400000
  and points between 0 and 1000000000
  and best between 0 and 1000000000
);
alter table public.profiles drop constraint if exists profiles_grenzen;
alter table public.profiles add constraint profiles_grenzen check (
  xp between 0 and 1000000000
  and jsonb_typeof(stats) = 'object' and pg_column_size(stats) <= 4000
  and jsonb_typeof(badges) = 'object' and pg_column_size(badges) <= 4000
);

-- Nicht angemeldete Besucher dürfen gar nichts.
revoke all on public.lists, public.profiles from anon;

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
