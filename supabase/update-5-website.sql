-- ==========================================================
-- Mavo City – Update 5: Website-Funktionen
-- Fraktions-Bewerbungen, Bürgerregister (Charaktere),
-- Event-Anmeldungen, Server-Statistik (Spielerverlauf).
--
-- Voraussetzung: update-3 und update-4 wurden ausgeführt.
-- Einmal komplett im Supabase SQL-Editor ausführen.
-- Kann gefahrlos erneut ausgeführt werden.
-- ==========================================================

-- Name + Avatar des eingeloggten Discord-Nutzers
create or replace function public.mavo_current_user()
returns table (name text, avatar text) language sql stable security definer set search_path = public as $$
  select left(coalesce(raw_user_meta_data->'custom_claims'->>'global_name', raw_user_meta_data->>'full_name',
                       raw_user_meta_data->>'name', 'Unbekannt'), 64),
         raw_user_meta_data->>'avatar_url'
    from auth.users where id = auth.uid();
$$;


-- ##########################################################
-- 1. Fraktions-Bewerbungen
-- ##########################################################
create table if not exists public.faction_applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  user_name   text not null default '',
  user_avatar text,
  faction     text not null check (char_length(faction) between 1 and 120),
  char_name   text not null check (char_length(char_name) between 2 and 80),
  char_age    integer check (char_age between 0 and 120),
  age         integer check (age between 12 and 99),
  playtime    text check (char_length(playtime) <= 120),
  story       text not null check (char_length(story) between 30 and 4000),
  motivation  text not null check (char_length(motivation) between 20 and 2000),
  status      text not null default 'offen' check (status in ('offen', 'bearbeitung', 'angenommen', 'abgelehnt')),
  team_note   text check (char_length(team_note) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.faction_applications enable row level security;
create index if not exists faction_applications_user on public.faction_applications (user_id, created_at desc);

-- Name/Avatar aus Discord, Status immer "offen" beim Einreichen
create or replace function public.faction_app_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare u record;
begin
  select * into u from public.mavo_current_user();
  new.user_id := auth.uid();
  new.user_name := coalesce(u.name, 'Unbekannt');
  new.user_avatar := u.avatar;
  new.status := 'offen';
  new.team_note := null;
  new.created_at := now();
  new.updated_at := now();
  -- Spam-Schutz: höchstens eine offene Bewerbung pro Fraktion und 3 pro Tag
  if exists (select 1 from public.faction_applications
              where user_id = auth.uid() and faction = new.faction and status in ('offen', 'bearbeitung')) then
    raise exception 'Du hast für diese Fraktion schon eine offene Bewerbung.';
  end if;
  if (select count(*) from public.faction_applications
       where user_id = auth.uid() and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Du kannst höchstens 3 Bewerbungen pro Tag abschicken.';
  end if;
  return new;
end $$;
drop trigger if exists faction_app_insert on public.faction_applications;
create trigger faction_app_insert before insert on public.faction_applications
  for each row execute function public.faction_app_before_insert();

drop policy if exists "bewerbung einreichen" on public.faction_applications;
create policy "bewerbung einreichen" on public.faction_applications for insert to authenticated
  with check (not public.forum_is_banned());
drop policy if exists "bewerbung lesen" on public.faction_applications;
create policy "bewerbung lesen" on public.faction_applications for select to authenticated
  using (user_id = auth.uid() or public.is_forum_team());
drop policy if exists "bewerbung zurückziehen" on public.faction_applications;
create policy "bewerbung zurückziehen" on public.faction_applications for delete to authenticated
  using ((user_id = auth.uid() and status = 'offen') or public.is_forum_admin());

-- Status ändern (Team & Admins)
create or replace function public.faction_app_set_status(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_forum_team() then raise exception 'Nur für Team und Admins.'; end if;
  if p_status not in ('offen', 'bearbeitung', 'angenommen', 'abgelehnt') then raise exception 'Ungültiger Status.'; end if;
  update public.faction_applications
     set status = p_status, team_note = left(nullif(trim(p_note), ''), 1000), updated_at = now()
   where id = p_id;
end $$;

-- Discord-Benachrichtigung (gleicher Webhook wie das Forum, optional eigener: 'discord_webhook_applications')
create or replace function public.faction_app_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hook text := coalesce((select value from public.app_settings where key = 'discord_webhook_applications'),
                        (select value from public.app_settings where key = 'discord_webhook_url'));
  site text := coalesce((select value from public.app_settings where key = 'site_url'), 'https://mavocity.com');
begin
  if hook is null then return new; end if;
  begin
    perform net.http_post(
      url := hook,
      body := jsonb_build_object(
        'username', 'Mavo City Bewerbungen',
        'embeds', jsonb_build_array(jsonb_build_object(
          'title', 'Neue Bewerbung: ' || left(new.faction, 200),
          'url', site || '/admin.html#applications',
          'description', '**' || new.char_name || '** (Discord: ' || new.user_name || ')',
          'color', 13936730
        ))
      )
    );
  exception when others then
    raise warning 'Discord-Webhook fehlgeschlagen: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists faction_app_discord on public.faction_applications;
create trigger faction_app_discord after insert on public.faction_applications
  for each row execute function public.faction_app_notify();

-- Benachrichtigung im Forum-Glöckchen, wenn sich der Status ändert
alter table public.forum_notifications drop constraint if exists forum_notifications_kind_check;
alter table public.forum_notifications add constraint forum_notifications_kind_check
  check (kind in ('reply', 'like', 'application'));

create or replace function public.faction_app_status_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status <> 'offen' then
    insert into public.forum_notifications (user_id, kind, actor_name, title)
    values (new.user_id, 'application', 'Mavo City Team',
            new.faction || ': ' || case new.status
              when 'angenommen' then 'angenommen' when 'abgelehnt' then 'abgelehnt' else 'in Bearbeitung' end);
  end if;
  return new;
end $$;
drop trigger if exists faction_app_status on public.faction_applications;
create trigger faction_app_status after update on public.faction_applications
  for each row execute function public.faction_app_status_notify();


-- ##########################################################
-- 2. Bürgerregister (Charaktere)
-- ##########################################################
create table if not exists public.characters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  owner_name  text not null default '',
  owner_avatar text,
  name        text not null check (char_length(name) between 2 and 60),
  age         integer check (age between 0 and 120),
  job         text check (char_length(job) <= 80),
  faction     text check (char_length(faction) <= 80),
  origin      text check (char_length(origin) <= 80),
  bio         text check (char_length(bio) <= 3000),
  image_url   text check (char_length(image_url) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.characters enable row level security;
create index if not exists characters_user on public.characters (user_id);

create or replace function public.characters_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare u record;
begin
  select * into u from public.mavo_current_user();
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.created_at := now();
    if (select count(*) from public.characters where user_id = auth.uid()) >= 3 then
      raise exception 'Du kannst höchstens 3 Charaktere anlegen.';
    end if;
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  if new.user_id = auth.uid() then
    new.owner_name := coalesce(u.name, 'Unbekannt');
    new.owner_avatar := u.avatar;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists characters_write on public.characters;
create trigger characters_write before insert or update on public.characters
  for each row execute function public.characters_before_write();

drop policy if exists "charaktere lesen" on public.characters;
create policy "charaktere lesen" on public.characters for select using (true);
drop policy if exists "charakter anlegen" on public.characters;
create policy "charakter anlegen" on public.characters for insert to authenticated
  with check (not public.forum_is_banned());
drop policy if exists "charakter bearbeiten" on public.characters;
create policy "charakter bearbeiten" on public.characters for update to authenticated
  using (user_id = auth.uid() or public.is_forum_admin()) with check (user_id = auth.uid() or public.is_forum_admin());
drop policy if exists "charakter löschen" on public.characters;
create policy "charakter löschen" on public.characters for delete to authenticated
  using (user_id = auth.uid() or public.is_forum_admin());

-- Bilder: jeder darf in seinen eigenen Ordner characters/<user-id>/ hochladen
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('characters', 'characters', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;
drop policy if exists "charakterbild upload" on storage.objects;
create policy "charakterbild upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'characters' and (storage.foldername(name))[1] = auth.uid()::text and not public.forum_is_banned());
drop policy if exists "charakterbild löschen" on storage.objects;
create policy "charakterbild löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'characters' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_forum_admin()));


-- ##########################################################
-- 3. Event-Anmeldungen
-- ##########################################################
-- event_key wird von der Website aus Titel + Datum gebildet
create table if not exists public.event_signups (
  event_key   text not null check (char_length(event_key) between 3 and 160),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  user_name   text not null default '',
  user_avatar text,
  created_at  timestamptz not null default now(),
  primary key (event_key, user_id)
);
alter table public.event_signups enable row level security;

create or replace function public.event_signup_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare u record;
begin
  select * into u from public.mavo_current_user();
  new.user_id := auth.uid();
  new.user_name := coalesce(u.name, 'Unbekannt');
  new.user_avatar := u.avatar;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists event_signup_insert on public.event_signups;
create trigger event_signup_insert before insert on public.event_signups
  for each row execute function public.event_signup_before_insert();

drop policy if exists "anmeldungen lesen" on public.event_signups;
create policy "anmeldungen lesen" on public.event_signups for select using (true);
drop policy if exists "anmelden" on public.event_signups;
create policy "anmelden" on public.event_signups for insert to authenticated
  with check (not public.forum_is_banned());
drop policy if exists "abmelden" on public.event_signups;
create policy "abmelden" on public.event_signups for delete to authenticated
  using (user_id = auth.uid() or public.is_forum_admin());


-- ##########################################################
-- 4. Server-Statistik (Spielerverlauf für die Seite "Server-Status")
-- ##########################################################
-- Alle 5 Minuten fragt die Datenbank die öffentliche FiveM-API ab und speichert die Spielerzahl.
-- Benötigt den Join-Code:
--   insert into public.app_settings (key, value) values ('cfx_code', 'abc123')
--     on conflict (key) do update set value = excluded.value;
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.server_stats (
  at        timestamptz primary key default now(),
  players   integer not null,
  max_slots integer
);
alter table public.server_stats enable row level security; -- Lesen nur über die Funktion unten

create table if not exists public.server_stats_pending (
  request_id bigint primary key,
  at         timestamptz not null default now()
);
alter table public.server_stats_pending enable row level security;

create or replace function public.collect_server_stats()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  code text := (select value from public.app_settings where key = 'cfx_code');
  r record;
  data jsonb;
begin
  -- 1) Antworten der letzten Abfragen auswerten
  for r in
    select p.request_id, p.at, resp.status_code, resp.content
      from public.server_stats_pending p
      join net._http_response resp on resp.id = p.request_id
  loop
    if r.status_code = 200 then
      begin
        data := r.content::jsonb -> 'Data';
        insert into public.server_stats (at, players, max_slots)
        values (date_trunc('minute', r.at), coalesce((data->>'clients')::int, 0), (data->>'sv_maxclients')::int)
        on conflict (at) do nothing;
      exception when others then null;
      end;
    elsif r.status_code = 404 then
      -- Server offline / nicht gelistet = 0 Spieler
      insert into public.server_stats (at, players) values (date_trunc('minute', r.at), 0) on conflict (at) do nothing;
    end if;
    delete from public.server_stats_pending where request_id = r.request_id;
  end loop;

  -- 2) Aufräumen
  delete from public.server_stats_pending where at < now() - interval '1 hour';
  delete from public.server_stats where at < now() - interval '60 days';

  -- 3) Neue Abfrage starten (Antwort wird beim nächsten Lauf gespeichert)
  if code is not null and code <> '' then
    insert into public.server_stats_pending (request_id)
    select net.http_get(
      url := 'https://servers-frontend.fivem.net/api/servers/single/' || code,
      headers := jsonb_build_object('User-Agent', 'MavoCityWebsite/1.0', 'Accept', 'application/json')
    );
  end if;
end $$;

-- Alle 5 Minuten ausführen
do $$
begin
  perform cron.unschedule('mavo-server-stats') where exists (select 1 from cron.job where jobname = 'mavo-server-stats');
  perform cron.schedule('mavo-server-stats', '*/5 * * * *', 'select public.collect_server_stats()');
end $$;

-- Daten für die Website: Verlauf (Stundenwerte) + "Wann ist am meisten los?"
create or replace function public.server_stats_summary(p_hours integer default 24)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('t', b, 'avg', round(a::numeric, 1), 'max', m) order by b)
      from (
        select date_trunc('hour', at) as b, avg(players) as a, max(players) as m
          from public.server_stats
         where at > now() - make_interval(hours => least(greatest(p_hours, 1), 24 * 31))
         group by 1
      ) s), '[]'::jsonb),
    'heat', coalesce((
      select jsonb_agg(jsonb_build_object('d', d, 'h', h, 'avg', round(a::numeric, 1)))
      from (
        select extract(isodow from at at time zone 'Europe/Berlin')::int as d,
               extract(hour from at at time zone 'Europe/Berlin')::int as h,
               avg(players) as a
          from public.server_stats
         where at > now() - interval '28 days'
         group by 1, 2
      ) x), '[]'::jsonb),
    'peak_7d', (select max(players) from public.server_stats where at > now() - interval '7 days'),
    'uptime_7d', (select round(100.0 * count(*) filter (where players > 0 or max_slots is not null) / nullif(count(*), 0), 1)
                    from public.server_stats where at > now() - interval '7 days')
  );
$$;
grant execute on function public.server_stats_summary(integer) to anon, authenticated;


-- ##########################################################
-- 5. Admin-Statistik erweitern
-- ##########################################################
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_forum_admin() then raise exception 'Nur für Admins.'; end if;
  return jsonb_build_object(
    'threads',      (select count(*) from public.forum_threads),
    'posts',        (select count(*) from public.forum_posts),
    'posts_7d',     (select count(*) from public.forum_posts where created_at > now() - interval '7 days'),
    'users',        (select count(*) from public.forum_profiles),
    'users_7d',     (select count(*) from public.forum_profiles where created_at > now() - interval '7 days'),
    'banned',       (select count(*) from public.forum_profiles where banned),
    'reports_open', (select count(*) from public.forum_reports where not resolved),
    'quiz_passed',  (select count(*) from public.quiz_results where passed),
    'quiz_7d',      (select count(*) from public.quiz_results where passed and created_at > now() - interval '7 days'),
    'polls_active', (select count(*) from public.polls where active and (ends_at is null or ends_at > now())),
    'apps_open',    (select count(*) from public.faction_applications where status in ('offen', 'bearbeitung')),
    'characters',   (select count(*) from public.characters)
  );
end $$;
