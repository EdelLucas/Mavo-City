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
