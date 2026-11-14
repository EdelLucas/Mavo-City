-- ==========================================================
-- Mavo City – UPDATE 5: Whitelist-Bewerbungen über die Website
-- Einmal im Supabase SQL-Editor ausführen (kann mehrfach ausgeführt werden).
-- Benötigt Update 3 + 4 (forum_profiles, is_forum_team).
-- ==========================================================

create table if not exists public.whitelist_applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  discord_name  text not null,
  discord_avatar text,
  age           integer not null check (age between 18 and 99),
  char_name     text not null check (char_length(char_name) between 3 and 60),
  char_age      integer check (char_age between 16 and 99),
  story         text not null check (char_length(story) between 300 and 4000),
  experience    text not null check (char_length(experience) between 10 and 1500),
  scenario      text not null check (char_length(scenario) between 50 and 1500),
  source        text check (char_length(source) <= 60),
  status        text not null default 'offen'
                check (status in ('offen', 'bearbeitung', 'angenommen', 'abgelehnt')),
  staff_note    text check (char_length(staff_note) <= 1000),
  reviewed_by   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Pro Person nur eine offene Bewerbung gleichzeitig
create unique index if not exists whitelist_one_open_idx
  on public.whitelist_applications (user_id) where status in ('offen', 'bearbeitung');
create index if not exists whitelist_status_idx on public.whitelist_applications (status, created_at desc);

alter table public.whitelist_applications enable row level security;

-- Discord-Name/Avatar immer aus dem Login übernehmen, Status startet immer bei "offen"
create or replace function public.whitelist_set_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare meta jsonb;
begin
  select raw_user_meta_data into meta from auth.users where id = auth.uid();
  new.user_id        := auth.uid();
  new.discord_name   := left(coalesce(meta->'custom_claims'->>'global_name', meta->>'full_name', meta->>'name', 'Unbekannt'), 64);
  new.discord_avatar := meta->>'avatar_url';
  new.status         := 'offen';
  new.staff_note     := null;
  new.reviewed_by    := null;
  new.created_at     := now();
  new.updated_at     := now();
  return new;
end $$;

drop trigger if exists whitelist_user on public.whitelist_applications;
create trigger whitelist_user before insert on public.whitelist_applications
  for each row execute function public.whitelist_set_user();

-- Team darf nur Status + Notiz ändern; Bearbeiter wird automatisch eingetragen
create or replace function public.whitelist_on_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare meta jsonb;
begin
  select raw_user_meta_data into meta from auth.users where id = auth.uid();
  new.id := old.id; new.user_id := old.user_id; new.discord_name := old.discord_name;
  new.discord_avatar := old.discord_avatar; new.age := old.age; new.char_name := old.char_name;
  new.char_age := old.char_age; new.story := old.story; new.experience := old.experience;
  new.scenario := old.scenario; new.source := old.source; new.created_at := old.created_at;
  new.reviewed_by := left(coalesce(meta->'custom_claims'->>'global_name', meta->>'full_name', meta->>'name', 'Team'), 64);
  new.updated_at  := now();
  return new;
end $$;

drop trigger if exists whitelist_review on public.whitelist_applications;
create trigger whitelist_review before update on public.whitelist_applications
  for each row execute function public.whitelist_on_review();

drop policy if exists "whitelist einreichen" on public.whitelist_applications;
create policy "whitelist einreichen" on public.whitelist_applications for insert to authenticated
  with check (true);

drop policy if exists "whitelist lesen" on public.whitelist_applications;
create policy "whitelist lesen" on public.whitelist_applications for select to authenticated
  using (user_id = auth.uid() or public.is_forum_team());

drop policy if exists "whitelist prüfen" on public.whitelist_applications;
create policy "whitelist prüfen" on public.whitelist_applications for update to authenticated
  using (public.is_forum_team()) with check (public.is_forum_team());

drop policy if exists "whitelist löschen" on public.whitelist_applications;
create policy "whitelist löschen" on public.whitelist_applications for delete to authenticated
  using (public.is_forum_admin());
