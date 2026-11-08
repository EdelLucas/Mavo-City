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

