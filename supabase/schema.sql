-- ==========================================================
-- Mavo City – Forum-Datenbank für Supabase
-- Einmal komplett im Supabase SQL-Editor ausführen.
-- Anleitung: siehe ANLEITUNG.md
-- ==========================================================

-- ---------- Tabellen ----------
create table if not exists public.forum_threads (
  id            uuid primary key default gen_random_uuid(),
  category      text not null check (category in ('news','allgemein','support','vorschlaege','bewerbungen','fraktionen')),
  title         text not null check (char_length(title) between 3 and 100),
  pinned        boolean not null default false,
  locked        boolean not null default false,
  author_id     uuid not null references auth.users on delete cascade,
  author_name   text not null,
  author_avatar text,
  created_at    timestamptz not null default now(),
  last_post_at  timestamptz not null default now(),
  reply_count   integer not null default 0
);

create table if not exists public.forum_posts (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references public.forum_threads on delete cascade,
  body          text not null check (char_length(body) between 1 and 5000),
  author_id     uuid not null references auth.users on delete cascade,
  author_name   text not null,
  author_avatar text,
  created_at    timestamptz not null default now()
);

create index if not exists forum_threads_category_idx on public.forum_threads (category, last_post_at desc);
create index if not exists forum_posts_thread_idx on public.forum_posts (thread_id, created_at);

-- Admins: Discord-Nutzer, die anpinnen, sperren und löschen dürfen.
-- Eintragen:  insert into public.forum_admins (user_id) values ('<UUID aus Authentication → Users>');
create table if not exists public.forum_admins (
  user_id uuid primary key references auth.users on delete cascade
);

-- ---------- Hilfsfunktionen ----------
create or replace function public.is_forum_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.forum_admins where user_id = auth.uid());
$$;

-- Autor (Name + Avatar) immer aus dem Discord-Login übernehmen – nicht fälschbar
create or replace function public.forum_set_author()
returns trigger language plpgsql security definer set search_path = public as $$
declare meta jsonb;
begin
  select raw_user_meta_data into meta from auth.users where id = auth.uid();
  new.author_id     := auth.uid();
  new.author_name   := left(coalesce(meta->'custom_claims'->>'global_name', meta->>'full_name', meta->>'name', 'Unbekannt'), 64);
  new.author_avatar := meta->>'avatar_url';
  new.created_at    := now();
  if tg_table_name = 'forum_threads' and not public.is_forum_admin() then
    new.pinned := false;
    new.locked := false;
  end if;
  return new;
end $$;

drop trigger if exists forum_threads_author on public.forum_threads;
create trigger forum_threads_author before insert on public.forum_threads
  for each row execute function public.forum_set_author();

drop trigger if exists forum_posts_author on public.forum_posts;
create trigger forum_posts_author before insert on public.forum_posts
  for each row execute function public.forum_set_author();

-- Antwortanzahl und "zuletzt aktiv" automatisch aktualisieren
create or replace function public.forum_update_thread_stats()
returns trigger language plpgsql security definer set search_path = public as $$
declare tid uuid := coalesce(new.thread_id, old.thread_id);
begin
  update public.forum_threads t set
    reply_count  = greatest((select count(*) from public.forum_posts where thread_id = tid) - 1, 0),
    last_post_at = coalesce((select max(created_at) from public.forum_posts where thread_id = tid), t.created_at)
  where t.id = tid;
  return null;
end $$;

drop trigger if exists forum_posts_stats on public.forum_posts;
create trigger forum_posts_stats after insert or delete on public.forum_posts
  for each row execute function public.forum_update_thread_stats();

-- Thema + ersten Beitrag in einem Schritt anlegen
create or replace function public.forum_create_thread(p_category text, p_title text, p_body text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare tid uuid;
begin
  insert into public.forum_threads (category, title, author_name) values (p_category, p_title, '')
    returning id into tid;
  insert into public.forum_posts (thread_id, body, author_name) values (tid, p_body, '');
  return tid;
end $$;

-- ---------- Row Level Security ----------
alter table public.forum_threads enable row level security;
alter table public.forum_posts   enable row level security;
alter table public.forum_admins  enable row level security;

-- Lesen: alle (auch ohne Login)
drop policy if exists "threads lesen" on public.forum_threads;
create policy "threads lesen" on public.forum_threads for select using (true);

drop policy if exists "posts lesen" on public.forum_posts;
create policy "posts lesen" on public.forum_posts for select using (true);

-- Thema erstellen: angemeldet; "Ankündigungen" nur Admins
drop policy if exists "threads erstellen" on public.forum_threads;
create policy "threads erstellen" on public.forum_threads for insert to authenticated
  with check (category <> 'news' or public.is_forum_admin());

-- Antworten: angemeldet, und nur wenn das Thema nicht gesperrt ist
drop policy if exists "posts erstellen" on public.forum_posts;
create policy "posts erstellen" on public.forum_posts for insert to authenticated
  with check (exists (
    select 1 from public.forum_threads t
    where t.id = thread_id and (not t.locked or public.is_forum_admin())
  ));

-- Löschen: eigene Beiträge oder Admin
drop policy if exists "posts löschen" on public.forum_posts;
create policy "posts löschen" on public.forum_posts for delete to authenticated
  using (author_id = auth.uid() or public.is_forum_admin());

-- Themen bearbeiten/löschen (anpinnen, sperren): nur Admins
drop policy if exists "threads admin update" on public.forum_threads;
create policy "threads admin update" on public.forum_threads for update to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());

drop policy if exists "threads admin delete" on public.forum_threads;
create policy "threads admin delete" on public.forum_threads for delete to authenticated
  using (public.is_forum_admin());

-- forum_admins ist nur über is_forum_admin() abfragbar (keine Policy = kein direkter Zugriff)



-- ##########################################################
-- ERWEITERUNGEN (Version 2)
-- Kann gefahrlos erneut ausgeführt werden.
-- ##########################################################

-- ---------- Beiträge bearbeiten ----------
alter table public.forum_posts add column if not exists edited_at timestamptz;

create or replace function public.forum_protect_post_update()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Nur der Text darf geändert werden
  new.id := old.id; new.thread_id := old.thread_id; new.author_id := old.author_id;
  new.author_name := old.author_name; new.author_avatar := old.author_avatar; new.created_at := old.created_at;
  new.edited_at := now();
  return new;
end $$;

drop trigger if exists forum_posts_protect on public.forum_posts;
create trigger forum_posts_protect before update on public.forum_posts
  for each row execute function public.forum_protect_post_update();

drop policy if exists "posts bearbeiten" on public.forum_posts;
create policy "posts bearbeiten" on public.forum_posts for update to authenticated
  using (author_id = auth.uid() or public.is_forum_admin())
  with check (author_id = auth.uid() or public.is_forum_admin());

-- ---------- Spam-Schutz ----------
create or replace function public.forum_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_forum_admin() then return new; end if;
  if tg_table_name = 'forum_posts' and exists (
    select 1 from public.forum_posts where author_id = auth.uid() and created_at > now() - interval '20 seconds'
  ) then
    raise exception 'Bitte warte 20 Sekunden zwischen zwei Beiträgen.';
  end if;
  if tg_table_name = 'forum_threads' and exists (
    select 1 from public.forum_threads where author_id = auth.uid() and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'Bitte warte 2 Minuten, bevor du ein neues Thema erstellst.';
  end if;
  return new;
end $$;

drop trigger if exists forum_posts_rate on public.forum_posts;
create trigger forum_posts_rate before insert on public.forum_posts
  for each row execute function public.forum_rate_limit();
drop trigger if exists forum_threads_rate on public.forum_threads;
create trigger forum_threads_rate before insert on public.forum_threads
  for each row execute function public.forum_rate_limit();

-- ---------- Beiträge melden ----------
create table if not exists public.forum_reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.forum_posts on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users on delete cascade,
  reason      text not null check (char_length(reason) between 3 and 500),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.forum_reports enable row level security;

drop policy if exists "melden" on public.forum_reports;
create policy "melden" on public.forum_reports for insert to authenticated
  with check (reporter_id = auth.uid());
drop policy if exists "meldungen admin" on public.forum_reports;
create policy "meldungen admin" on public.forum_reports for all to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());

-- ---------- Einstellungen (nicht öffentlich lesbar) ----------
-- Discord-Webhook für neue Forenthemen eintragen:
--   insert into public.app_settings (key, value) values
--     ('discord_webhook_url', 'https://discord.com/api/webhooks/...'),
--     ('site_url', 'https://mavocity.com')
--   on conflict (key) do update set value = excluded.value;
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security; -- keine Policy = kein Zugriff von außen

-- ---------- Discord-Benachrichtigung bei neuen Themen ----------
create extension if not exists pg_net;

create or replace function public.forum_notify_discord()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hook text := (select value from public.app_settings where key = 'discord_webhook_url');
  site text := coalesce((select value from public.app_settings where key = 'site_url'), 'https://mavocity.com');
begin
  if hook is null then return new; end if;
  begin
    perform net.http_post(
      url := hook,
      body := jsonb_build_object(
        'username', 'Mavo City Forum',
        'embeds', jsonb_build_array(jsonb_build_object(
          'title', left(new.title, 250),
          'url', site || '/#forum/thread/' || new.id,
          'description', 'Neues Thema von **' || new.author_name || '** in *' || new.category || '*',
          'color', 16752412
        ))
      )
    );
  exception when others then
    -- Forum soll auch funktionieren, wenn Discord nicht erreichbar ist
    raise warning 'Discord-Webhook fehlgeschlagen: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists forum_threads_discord on public.forum_threads;
create trigger forum_threads_discord after insert on public.forum_threads
  for each row execute function public.forum_notify_discord();

-- ---------- Website-Inhalte (Admin-Bereich) ----------
create table if not exists public.site_content (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;

drop policy if exists "inhalte lesen" on public.site_content;
create policy "inhalte lesen" on public.site_content for select using (true);
drop policy if exists "inhalte admin" on public.site_content;
create policy "inhalte admin" on public.site_content for all to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());

-- ---------- Bilder-Upload (Galerie) ----------
insert into storage.buckets (id, name, public) values ('gallery', 'gallery', true)
  on conflict (id) do nothing;

drop policy if exists "galerie upload admin" on storage.objects;
create policy "galerie upload admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and public.is_forum_admin());
drop policy if exists "galerie löschen admin" on storage.objects;
create policy "galerie löschen admin" on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and public.is_forum_admin());

-- ---------- Umfragen ----------
create table if not exists public.polls (
  id         uuid primary key default gen_random_uuid(),
  question   text not null check (char_length(question) between 3 and 200),
  options    jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  active     boolean not null default true,
  ends_at    timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.poll_votes (
  poll_id      uuid not null references public.polls on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  option_index integer not null check (option_index >= 0),
  created_at   timestamptz not null default now(),
  primary key (poll_id, user_id)
);
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "umfragen lesen" on public.polls;
create policy "umfragen lesen" on public.polls for select using (true);
drop policy if exists "umfragen admin" on public.polls;
create policy "umfragen admin" on public.polls for all to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());

drop policy if exists "eigene stimme lesen" on public.poll_votes;
create policy "eigene stimme lesen" on public.poll_votes for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "abstimmen" on public.poll_votes;
create policy "abstimmen" on public.poll_votes for insert to authenticated
  with check (
    user_id = auth.uid() and exists (
      select 1 from public.polls p
      where p.id = poll_id and p.active and (p.ends_at is null or p.ends_at > now())
        and option_index < jsonb_array_length(p.options)
    )
  );

-- Ergebnisse für alle sichtbar, ohne zu verraten, wer wie gestimmt hat
create or replace function public.poll_results(p_poll uuid)
returns table (option_index integer, votes bigint)
language sql stable security definer set search_path = public as $$
  select option_index, count(*) from public.poll_votes where poll_id = p_poll group by option_index;
$$;

-- ---------- Regel-Quiz ----------
create table if not exists public.quiz_results (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  user_name  text not null,
  score      integer not null,
  total      integer not null,
  passed     boolean not null,
  created_at timestamptz not null default now()
);
alter table public.quiz_results enable row level security;

create or replace function public.quiz_set_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare meta jsonb;
begin
  select raw_user_meta_data into meta from auth.users where id = auth.uid();
  new.user_id := auth.uid();
  new.user_name := left(coalesce(meta->'custom_claims'->>'global_name', meta->>'full_name', meta->>'name', 'Unbekannt'), 64);
  new.created_at := now();
  return new;
end $$;

drop trigger if exists quiz_results_user on public.quiz_results;
create trigger quiz_results_user before insert on public.quiz_results
  for each row execute function public.quiz_set_user();

drop policy if exists "quiz eintragen" on public.quiz_results;
create policy "quiz eintragen" on public.quiz_results for insert to authenticated with check (true);
drop policy if exists "quiz lesen" on public.quiz_results;
create policy "quiz lesen" on public.quiz_results for select to authenticated
  using (user_id = auth.uid() or public.is_forum_admin());
drop policy if exists "quiz admin löschen" on public.quiz_results;
create policy "quiz admin löschen" on public.quiz_results for delete to authenticated
  using (public.is_forum_admin());


-- ##########################################################
-- UPDATE 3 (Forum & Admin-Panel) – identisch mit update-3-forum-admin.sql
-- ##########################################################
-- ==========================================================
-- Mavo City – Update 3: Forum & Admin-Panel
-- Profile, Rollen, Sperren, Likes, Benachrichtigungen,
-- frei bearbeitbare Forum-Kategorien, Admin-Statistiken.
--
-- Einmal komplett im Supabase SQL-Editor ausführen.
-- Kann gefahrlos erneut ausgeführt werden.
-- ==========================================================

-- ---------- Profile ----------
create table if not exists public.forum_profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Unbekannt',
  avatar_url   text,
  bio          text check (bio is null or char_length(bio) <= 500),
  role         text not null default 'member' check (role in ('member', 'team', 'admin')),
  banned       boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.forum_profiles enable row level security;

drop policy if exists "profile lesen" on public.forum_profiles;
create policy "profile lesen" on public.forum_profiles for select using (true);
drop policy if exists "eigenes profil bearbeiten" on public.forum_profiles;
create policy "eigenes profil bearbeiten" on public.forum_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Nutzer dürfen nur ihre Beschreibung ändern – Rolle/Sperre nur über Admin-Funktionen
create or replace function public.forum_protect_profile()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('mavo.admin_action', true), '') <> '1' then
    new.user_id := old.user_id; new.role := old.role; new.banned := old.banned; new.created_at := old.created_at;
    if coalesce(current_setting('mavo.sync_profile', true), '') <> '1' then
      new.display_name := old.display_name; new.avatar_url := old.avatar_url;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists forum_profiles_protect on public.forum_profiles;
create trigger forum_profiles_protect before update on public.forum_profiles
  for each row execute function public.forum_protect_profile();

-- Name/Avatar aus dem Discord-Login übernehmen
create or replace function public.forum_sync_profile(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare meta jsonb;
begin
  select raw_user_meta_data into meta from auth.users where id = p_user;
  perform set_config('mavo.sync_profile', '1', true);
  insert into public.forum_profiles (user_id, display_name, avatar_url)
  values (
    p_user,
    left(coalesce(meta->'custom_claims'->>'global_name', meta->>'full_name', meta->>'name', 'Unbekannt'), 64),
    meta->>'avatar_url'
  )
  on conflict (user_id) do update set display_name = excluded.display_name, avatar_url = excluded.avatar_url;
  perform set_config('mavo.sync_profile', '', true);
end $$;

-- Wird nach jedem Login von der Website aufgerufen
create or replace function public.forum_touch_profile()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  perform public.forum_sync_profile(auth.uid());
end $$;

-- Neue Nutzer bekommen automatisch ein Profil
create or replace function public.forum_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.forum_sync_profile(new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created_mavo on auth.users;
create trigger on_auth_user_created_mavo after insert on auth.users
  for each row execute function public.forum_new_user();

-- Vorhandene Nutzer nachtragen
do $$
declare u record;
begin
  for u in select id from auth.users loop
    perform public.forum_sync_profile(u.id);
  end loop;
end $$;

-- Rolle "admin" mit forum_admins abgleichen
do $$
begin
  perform set_config('mavo.admin_action', '1', true);
  update public.forum_profiles p set role = 'admin'
    where exists (select 1 from public.forum_admins a where a.user_id = p.user_id) and p.role <> 'admin';
  perform set_config('mavo.admin_action', '', true);
end $$;

-- ---------- Admin-Funktionen ----------
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_forum_admin() then raise exception 'Nur für Admins.'; end if;
  if p_role not in ('member', 'team', 'admin') then raise exception 'Ungültige Rolle.'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'Du kannst dir nicht selbst die Admin-Rechte entziehen.'; end if;
  perform set_config('mavo.admin_action', '1', true);
  update public.forum_profiles set role = p_role where user_id = p_user;
  perform set_config('mavo.admin_action', '', true);
  if p_role = 'admin' then
    insert into public.forum_admins (user_id) values (p_user) on conflict do nothing;
  else
    delete from public.forum_admins where user_id = p_user;
  end if;
end $$;

create or replace function public.admin_set_banned(p_user uuid, p_banned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_forum_admin() then raise exception 'Nur für Admins.'; end if;
  if p_user = auth.uid() then raise exception 'Du kannst dich nicht selbst sperren.'; end if;
  perform set_config('mavo.admin_action', '1', true);
  update public.forum_profiles set banned = p_banned where user_id = p_user;
  perform set_config('mavo.admin_action', '', true);
end $$;

create or replace function public.forum_is_banned()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.forum_profiles where user_id = auth.uid() and banned);
$$;

-- ---------- Beitragszahlen pro Nutzer (für Ränge) ----------
create or replace view public.forum_user_stats as
  select author_id as user_id, count(*)::int as post_count, max(created_at) as last_post_at
  from public.forum_posts group by author_id;
grant select on public.forum_user_stats to anon, authenticated;

-- ---------- Kategorien frei bearbeitbar ----------
-- Die feste Liste wird entfernt; Kategorien kommen aus dem Admin-Bereich (site_content "forum").
alter table public.forum_threads drop constraint if exists forum_threads_category_check;
alter table public.forum_threads drop constraint if exists forum_threads_category_len;
alter table public.forum_threads add constraint forum_threads_category_len
  check (char_length(category) between 1 and 40 and category ~ '^[a-z0-9-]+$');

-- Darf in dieser Kategorie nur ein Admin schreiben?
create or replace function public.forum_category_admin_only(p_category text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select bool_or(coalesce((c->>'adminOnly')::boolean, false))
       from public.site_content s, jsonb_array_elements(s.data) c
      where s.key = 'forum' and c->>'id' = p_category),
    p_category = 'news'
  );
$$;

drop policy if exists "threads erstellen" on public.forum_threads;
create policy "threads erstellen" on public.forum_threads for insert to authenticated
  with check (
    not public.forum_is_banned()
    and (not public.forum_category_admin_only(category) or public.is_forum_admin())
  );

drop policy if exists "posts erstellen" on public.forum_posts;
create policy "posts erstellen" on public.forum_posts for insert to authenticated
  with check (
    not public.forum_is_banned()
    and exists (
      select 1 from public.forum_threads t
      where t.id = thread_id and (not t.locked or public.is_forum_admin())
    )
  );

-- Bearbeiten markiert nur bei geändertem Text als "bearbeitet"
create or replace function public.forum_protect_post_update()
returns trigger language plpgsql set search_path = public as $$
begin
  new.id := old.id; new.thread_id := old.thread_id; new.author_id := old.author_id;
  new.author_name := old.author_name; new.author_avatar := old.author_avatar; new.created_at := old.created_at;
  new.edited_at := case when new.body is distinct from old.body then now() else old.edited_at end;
  return new;
end $$;

-- Name/Avatar beim Schreiben aktuell halten
create or replace function public.forum_set_author()
returns trigger language plpgsql security definer set search_path = public as $$
declare meta jsonb;
begin
  select raw_user_meta_data into meta from auth.users where id = auth.uid();
  new.author_id     := auth.uid();
  new.author_name   := left(coalesce(meta->'custom_claims'->>'global_name', meta->>'full_name', meta->>'name', 'Unbekannt'), 64);
  new.author_avatar := meta->>'avatar_url';
  new.created_at    := now();
  if tg_table_name = 'forum_threads' and not public.is_forum_admin() then
    new.pinned := false;
    new.locked := false;
  end if;
  perform public.forum_sync_profile(auth.uid());
  return new;
end $$;

-- ---------- Likes ----------
create table if not exists public.forum_likes (
  post_id    uuid not null references public.forum_posts on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.forum_likes enable row level security;

drop policy if exists "likes lesen" on public.forum_likes;
create policy "likes lesen" on public.forum_likes for select using (true);
drop policy if exists "liken" on public.forum_likes;
create policy "liken" on public.forum_likes for insert to authenticated
  with check (user_id = auth.uid() and not public.forum_is_banned());
drop policy if exists "like entfernen" on public.forum_likes;
create policy "like entfernen" on public.forum_likes for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.forum_post_likes(p_posts uuid[])
returns table (post_id uuid, likes bigint, mine boolean)
language sql stable security definer set search_path = public as $$
  select l.post_id, count(*), coalesce(bool_or(l.user_id = auth.uid()), false)
  from public.forum_likes l where l.post_id = any(p_posts) group by l.post_id;
$$;

-- ---------- Benachrichtigungen ----------
create table if not exists public.forum_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null check (kind in ('reply', 'like')),
  thread_id  uuid references public.forum_threads on delete cascade,
  post_id    uuid references public.forum_posts on delete cascade,
  actor_name text not null,
  title      text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists forum_notifications_user_idx on public.forum_notifications (user_id, created_at desc);
alter table public.forum_notifications enable row level security;

drop policy if exists "eigene benachrichtigungen" on public.forum_notifications;
create policy "eigene benachrichtigungen" on public.forum_notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "benachrichtigungen lesen markieren" on public.forum_notifications;
create policy "benachrichtigungen lesen markieren" on public.forum_notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "benachrichtigungen löschen" on public.forum_notifications;
create policy "benachrichtigungen löschen" on public.forum_notifications for delete to authenticated
  using (user_id = auth.uid());

-- Antwort -> alle bisherigen Teilnehmer des Themas benachrichtigen
create or replace function public.forum_notify_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare th record;
begin
  select id, title, author_id into th from public.forum_threads where id = new.thread_id;
  if th.id is null then return new; end if;
  insert into public.forum_notifications (user_id, kind, thread_id, post_id, actor_name, title)
  select distinct u, 'reply', th.id, new.id, new.author_name, th.title
  from (
    select th.author_id as u
    union
    select author_id from (select author_id from public.forum_posts where thread_id = th.id order by created_at desc limit 50) recent
  ) participants
  where u is not null and u <> new.author_id;
  return new;
end $$;

drop trigger if exists forum_posts_notify on public.forum_posts;
create trigger forum_posts_notify after insert on public.forum_posts
  for each row execute function public.forum_notify_reply();

-- Like -> Verfasser des Beitrags benachrichtigen
create or replace function public.forum_notify_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record; actor text;
begin
  select fp.id, fp.author_id, t.id as thread_id, t.title into p
    from public.forum_posts fp join public.forum_threads t on t.id = fp.thread_id where fp.id = new.post_id;
  if p.id is null or p.author_id = new.user_id then return new; end if;
  select display_name into actor from public.forum_profiles where user_id = new.user_id;
  insert into public.forum_notifications (user_id, kind, thread_id, post_id, actor_name, title)
  values (p.author_id, 'like', p.thread_id, p.id, coalesce(actor, 'Jemand'), p.title);
  return new;
end $$;

drop trigger if exists forum_likes_notify on public.forum_likes;
create trigger forum_likes_notify after insert on public.forum_likes
  for each row execute function public.forum_notify_like();

-- ---------- Statistik für das Admin-Dashboard ----------
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
    'polls_active', (select count(*) from public.polls where active and (ends_at is null or ends_at > now()))
  );
end $$;


-- ##########################################################
-- UPDATE 4 (Forum-Struktur) – identisch mit update-4-forum-struktur.sql
-- ##########################################################
-- ==========================================================
-- Mavo City – Update 4: Forum-Struktur
-- Status-Präfixe (Offen / In Bearbeitung / Angenommen / Abgelehnt /
-- Geschlossen) und "letzter Beitrag" pro Thema.
--
-- Voraussetzung: update-3-forum-admin.sql wurde ausgeführt.
-- Einmal komplett im Supabase SQL-Editor ausführen.
-- Kann gefahrlos erneut ausgeführt werden.
-- ==========================================================

-- ---------- Neue Spalten ----------
alter table public.forum_threads add column if not exists status text;
alter table public.forum_threads drop constraint if exists forum_threads_status_check;
alter table public.forum_threads add constraint forum_threads_status_check
  check (status is null or status in ('offen', 'bearbeitung', 'angenommen', 'abgelehnt', 'geschlossen'));

alter table public.forum_threads add column if not exists last_author_name text;
alter table public.forum_threads add column if not exists last_author_avatar text;
alter table public.forum_threads add column if not exists last_author_id uuid;

-- ---------- Team-Mitglieder (Rolle team oder admin) ----------
create or replace function public.is_forum_team()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_forum_admin()
      or exists (select 1 from public.forum_profiles where user_id = auth.uid() and role in ('team', 'admin'));
$$;

-- ---------- Status setzen (Team & Admins) ----------
-- Abgeschlossene Themen (angenommen / abgelehnt / geschlossen) werden automatisch gesperrt.
create or replace function public.forum_set_status(p_thread uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_forum_team() then raise exception 'Nur für Team und Admins.'; end if;
  if p_status is not null and p_status not in ('offen', 'bearbeitung', 'angenommen', 'abgelehnt', 'geschlossen') then
    raise exception 'Ungültiger Status.';
  end if;
  update public.forum_threads
     set status = p_status,
         locked = coalesce(p_status in ('angenommen', 'abgelehnt', 'geschlossen'), false)
   where id = p_thread;
end $$;

-- ---------- "Letzter Beitrag" automatisch pflegen ----------
create or replace function public.forum_update_thread_stats()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tid uuid := coalesce(new.thread_id, old.thread_id);
  last record;
begin
  select author_id, author_name, author_avatar, created_at into last
    from public.forum_posts where thread_id = tid order by created_at desc limit 1;
  update public.forum_threads t set
    reply_count        = greatest((select count(*) from public.forum_posts where thread_id = tid) - 1, 0),
    last_post_at       = coalesce(last.created_at, t.created_at),
    last_author_id     = last.author_id,
    last_author_name   = last.author_name,
    last_author_avatar = last.author_avatar
  where t.id = tid;
  return null;
end $$;

-- Bestehende Themen nachtragen
update public.forum_threads t set
  last_author_id = l.author_id, last_author_name = l.author_name, last_author_avatar = l.author_avatar
from (
  select distinct on (thread_id) thread_id, author_id, author_name, author_avatar
  from public.forum_posts order by thread_id, created_at desc
) l
where l.thread_id = t.id;


-- ##########################################################
-- UPDATE 5 (Website-Funktionen) – identisch mit update-5-website.sql
-- ##########################################################
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
