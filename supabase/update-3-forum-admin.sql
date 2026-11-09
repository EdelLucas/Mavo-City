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
