/* ==========================================================
   Mavo City – Forum
   Routen:  #forum                        -> Übersicht (Kategorien, Aktivität)
            #forum/cat/<id>[/<seite>]     -> Themen einer Kategorie
            #forum/thread/<id>[/<seite>]  -> Beiträge eines Themas
            #forum/user/<id>              -> Profil
            #forum/search/<begriff>       -> Suche über alle Kategorien
            #forum/new[/<kategorie>]      -> Neues Thema

   Speicher:
   - SupabaseStore: echtes Forum mit Discord-Login (js/supabase.js)
     Profile, Likes, Benachrichtigungen benötigen supabase/update-3-forum-admin.sql
   - LocalStore:    Demo-Modus ohne Supabase (nur im eigenen Browser)
   ========================================================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = window.escapeHtml;
  const THREADS_PER_PAGE = 20;
  const POSTS_PER_PAGE = 15;
  const COOLDOWN_MS = 20_000;

  const pageOf = (items, page, per) => items.slice((page - 1) * per, page * per);
  const lastPage = (total, per) => Math.max(1, Math.ceil(total / per));
  const cats = () => CONTENT.forum || FORUM_CATEGORIES;
  const catById = (id) => cats().find((c) => c.id === id);

  /* ---------- Ränge nach Anzahl Beiträge ---------- */
  const RANKS = [[300, "Legende"], [100, "Urgestein"], [25, "Stammgast"], [5, "Bürger"], [0, "Neuling"]];
  const rankOf = (n = 0) => RANKS.find(([min]) => n >= min)[1];
  const ROLE_LABEL = { admin: "Admin", team: "Team" };

  const sortThreads = (list, sort) => list.sort((a, b) => {
    if (b.pinned !== a.pinned) return b.pinned - a.pinned;
    if (sort === "new") return new Date(b.createdAt) - new Date(a.createdAt);
    if (sort === "replies") return b.replies - a.replies;
    return new Date(b.lastAt) - new Date(a.lastAt);
  });

  /* ==========================================================
     Speicher: Demo-Modus (localStorage)
     ========================================================== */
  function createLocalStore() {
    const KEY = "mavo_forum_v2";
    const USER_KEY = "mavo_forum_user";
    const LIKE_KEY = "mavo_forum_likes";
    const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
    const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* blockiert */ } };

    let threads;
    try { threads = JSON.parse(read(KEY)) || structuredClone(FORUM_SEED); } catch { threads = structuredClone(FORUM_SEED); }
    let likes;
    try { likes = JSON.parse(read(LIKE_KEY)) || {}; } catch { likes = {}; }
    const save = () => write(KEY, JSON.stringify(threads));
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    let name = read(USER_KEY) || "";
    let lastPostAt = 0;

    const cooldown = () => {
      if (Date.now() - lastPostAt < COOLDOWN_MS) throw new Error(t("Bitte warte 20 Sekunden zwischen zwei Beiträgen."));
      lastPostAt = Date.now();
    };
    const summary = (th) => ({
      id: th.id, title: th.title, category: th.cat, pinned: !!th.pinned, locked: !!th.locked,
      author: th.posts[0]?.author || "?", authorId: th.posts[0]?.author || "?",
      createdAt: th.posts[0]?.date, lastAt: th.posts.at(-1)?.date || th.posts[0]?.date,
      lastAuthor: th.posts.at(-1)?.author, lastAvatar: "", replies: Math.max(0, th.posts.length - 1),
      status: th.status || null,
    });
    const find = (id) => threads.find((x) => x.id === id);
    const allPosts = () => threads.flatMap((th) => th.posts.map((p) => ({ ...p, thread: th })));

    return {
      mode: "local",
      user: () => (name ? { id: name, name, avatar: "", isAdmin: false } : null),
      async login() {
        const n = (prompt(t("Dein Name im Forum (z.B. dein Discord- oder Charaktername):"), name) || "").trim().slice(0, 32);
        if (n) { name = n; write(USER_KEY, n); }
      },
      async logout() { name = ""; try { localStorage.removeItem(USER_KEY); } catch { /* egal */ } },
      async overview() {
        const stats = {};
        const list = threads.map(summary);
        list.forEach((th) => {
          const s = (stats[th.category] ||= { threads: 0, posts: 0, latest: null });
          s.threads++; s.posts += th.replies + 1;
          if (!s.latest || new Date(th.lastAt) > new Date(s.latest.lastAt)) s.latest = th;
        });
        const latest = sortThreads([...list], "activity").slice(0, 6);
        return { stats, latest, totals: { threads: list.length, posts: allPosts().length, members: new Set(allPosts().map((p) => p.author)).size } };
      },
      async listThreads(cat, { page, q, sort, status }) {
        const all = sortThreads(threads.filter((th) => (!cat || th.cat === cat) && th.title.toLowerCase().includes(q.toLowerCase())).map(summary)
          .filter((th) => !status || (th.status || "offen") === status), sort);
        return { items: pageOf(all, page, THREADS_PER_PAGE), total: all.length };
      },
      async getThread(id, page) {
        const th = find(id);
        if (!th) return null;
        const total = th.posts.length;
        const p = page === "last" ? lastPage(total, POSTS_PER_PAGE) : page;
        return {
          thread: summary(th),
          posts: pageOf(th.posts, p, POSTS_PER_PAGE).map((x) => ({
            id: x.id, author: x.author, authorId: x.author, avatar: "", date: x.date, edited: x.edited, text: x.text,
          })),
          total, page: p, offset: (p - 1) * POSTS_PER_PAGE,
        };
      },
      async createThread(cat, title, text) {
        cooldown();
        const th = { id: uid(), cat, pinned: false, title, posts: [{ id: uid(), author: name, date: new Date().toISOString(), text }] };
        threads.push(th); save();
        return th.id;
      },
      async reply(threadId, text) {
        cooldown();
        find(threadId).posts.push({ id: uid(), author: name, date: new Date().toISOString(), text });
        save();
      },
      async editPost(threadId, postId, text) {
        const p = find(threadId).posts.find((x) => x.id === postId);
        p.text = text; p.edited = new Date().toISOString(); save();
      },
      async deletePost(threadId, postId) {
        const th = find(threadId);
        th.posts = th.posts.filter((p) => p.id !== postId); save();
      },
      async report() { throw new Error(t("Melden ist im Demo-Modus nicht verfügbar.")); },
      async setPinned() {}, async setLocked() {}, async deleteThread() {},
      async setStatus(id, status) {
        const th = find(id); th.status = status; th.locked = ["angenommen", "abgelehnt", "geschlossen"].includes(status); save();
      },
      async profiles(ids) {
        const counts = {};
        allPosts().forEach((p) => (counts[p.author] = (counts[p.author] || 0) + 1));
        return Object.fromEntries(ids.map((id) => [id, { id, name: id, avatar: "", role: "member", banned: false, postCount: counts[id] || 0 }]));
      },
      async getProfile(id) {
        const posts = allPosts().filter((p) => p.author === id).sort((a, b) => new Date(b.date) - new Date(a.date));
        if (!posts.length && id !== name) return null;
        return {
          id, name: id, avatar: "", role: "member", banned: false, bio: "", createdAt: posts.at(-1)?.date,
          postCount: posts.length,
          recent: posts.slice(0, 10).map((p) => ({ id: p.id, text: p.text, date: p.date, threadId: p.thread.id, threadTitle: p.thread.title })),
        };
      },
      async updateBio() { throw new Error(t("Im Demo-Modus nicht verfügbar.")); },
      async likes(postIds) {
        return Object.fromEntries(postIds.map((id) => [id, { likes: likes[id] ? 1 : 0, mine: !!likes[id] }]));
      },
      async toggleLike(postId, liked) {
        if (liked) delete likes[postId]; else likes[postId] = 1;
        write(LIKE_KEY, JSON.stringify(likes));
      },
      async notifications() { return []; },
      async markRead() {},
      async setRole() {}, async setBanned() {},
    };
  }

  /* ==========================================================
     Speicher: Supabase (echtes Forum, Login mit Discord)
     ========================================================== */
  function createSupabaseStore(sb) {
    const check = ({ data, error }) => { if (error) throw error; return data; };
    // Funktionen aus Update 3 – falls noch nicht eingespielt, ohne Fehler weiter
    const optional = async (fn, fallback) => { try { return await fn(); } catch (err) { console.warn("Forum-Erweiterung nicht verfügbar:", err.message); return fallback; } };
    const toSummary = (th) => ({
      id: th.id, title: th.title, category: th.category, pinned: th.pinned, locked: th.locked,
      author: th.author_name, authorId: th.author_id, avatar: th.author_avatar,
      createdAt: th.created_at, lastAt: th.last_post_at, replies: th.reply_count,
      status: th.status || null, lastAuthor: th.last_author_name || null, lastAvatar: th.last_author_avatar || null,
    });
    const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => "\\" + c);
    const COLS_BASE = "id, title, category, pinned, locked, author_id, author_name, author_avatar, created_at, last_post_at, reply_count";
    // Spalten aus Update 4 (Status, letzter Beitrag) – falls noch nicht eingespielt, ohne sie weiter
    let v4 = true;
    const cols = () => (v4 ? COLS_BASE + ", status, last_author_name, last_author_avatar" : COLS_BASE);
    async function threadsQuery(build) {
      let res = await build(cols());
      if (res.error && v4 && /status|last_author/.test(res.error.message || "")) {
        v4 = false;
        console.warn("Update 4 noch nicht eingespielt – Forum ohne Status-Präfixe");
        res = await build(cols());
      }
      return res;
    }

    return {
      mode: "supabase",
      user: () => MavoAuth.user,
      login: () => MavoAuth.login(),
      logout: () => MavoAuth.logout(),
      async overview() {
        const rows = check(await threadsQuery((c) => sb.from("forum_threads").select(c).order("last_post_at", { ascending: false }).limit(1000)));
        const stats = {};
        let posts = 0;
        rows.forEach((r) => {
          const th = toSummary(r);
          const s = (stats[th.category] ||= { threads: 0, posts: 0, latest: null });
          s.threads++; s.posts += th.replies + 1; posts += th.replies + 1;
          if (!s.latest) s.latest = th;
        });
        const members = await optional(async () => {
          const { count, error } = await sb.from("forum_profiles").select("user_id", { count: "exact", head: true });
          if (error) throw error;
          return count;
        }, null);
        return { stats, latest: rows.slice(0, 6).map(toSummary), totals: { threads: rows.length, posts, members } };
      },
      async listThreads(cat, { page, q, sort, status }) {
        const from = (page - 1) * THREADS_PER_PAGE;
        const { data, count, error } = await threadsQuery((c) => {
          let query = sb.from("forum_threads").select(c, { count: "exact" });
          if (cat) query = query.eq("category", cat);
          if (q) query = query.ilike("title", `%${likeEscape(q)}%`);
          if (status && v4) query = status === "offen" ? query.or("status.is.null,status.eq.offen") : query.eq("status", status);
          query = query.order("pinned", { ascending: false });
          if (sort === "new") query = query.order("created_at", { ascending: false });
          else if (sort === "replies") query = query.order("reply_count", { ascending: false });
          else query = query.order("last_post_at", { ascending: false });
          return query.range(from, from + THREADS_PER_PAGE - 1);
        });
        if (error) throw error;
        return { items: data.map(toSummary), total: count ?? data.length };
      },
      async getThread(id, page) {
        const thread = check(await sb.from("forum_threads").select("*").eq("id", id).maybeSingle());
        if (!thread) return null;
        const total = thread.reply_count + 1;
        const p = page === "last" ? lastPage(total, POSTS_PER_PAGE) : page;
        const from = (p - 1) * POSTS_PER_PAGE;
        const posts = check(await sb.from("forum_posts").select("*").eq("thread_id", id)
          .order("created_at").range(from, from + POSTS_PER_PAGE - 1));
        return {
          thread: toSummary(thread),
          posts: posts.map((x) => ({
            id: x.id, author: x.author_name, authorId: x.author_id, avatar: x.author_avatar,
            date: x.created_at, edited: x.edited_at, text: x.body,
          })),
          total, page: p, offset: from,
        };
      },
      async createThread(cat, title, text) {
        return check(await sb.rpc("forum_create_thread", { p_category: cat, p_title: title, p_body: text }));
      },
      async reply(threadId, text) {
        check(await sb.from("forum_posts").insert({ thread_id: threadId, body: text, author_name: "" }));
      },
      async editPost(threadId, postId, text) {
        check(await sb.from("forum_posts").update({ body: text }).eq("id", postId));
      },
      async deletePost(threadId, postId) {
        check(await sb.from("forum_posts").delete().eq("id", postId));
      },
      async report(postId, reason) {
        check(await sb.from("forum_reports").insert({ post_id: postId, reason }));
      },
      async setPinned(id, pinned) { check(await sb.from("forum_threads").update({ pinned }).eq("id", id)); },
      async setStatus(id, status) { check(await sb.rpc("forum_set_status", { p_thread: id, p_status: status })); },
      async setLocked(id, locked) { check(await sb.from("forum_threads").update({ locked }).eq("id", id)); },
      async deleteThread(id) { check(await sb.from("forum_threads").delete().eq("id", id)); },
      async profiles(ids) {
        if (!ids.length) return {};
        return optional(async () => {
          const [prof, stats] = await Promise.all([
            sb.from("forum_profiles").select("user_id, display_name, avatar_url, role, banned").in("user_id", ids),
            sb.from("forum_user_stats").select("user_id, post_count").in("user_id", ids),
          ]);
          const counts = Object.fromEntries((check(stats) || []).map((s) => [s.user_id, s.post_count]));
          return Object.fromEntries(check(prof).map((p) => [p.user_id, {
            id: p.user_id, name: p.display_name, avatar: p.avatar_url, role: p.role, banned: p.banned, postCount: counts[p.user_id] || 0,
          }]));
        }, {});
      },
      async getProfile(id) {
        const prof = await optional(async () => check(await sb.from("forum_profiles").select("*").eq("user_id", id).maybeSingle()), null);
        const posts = check(await sb.from("forum_posts").select("id, body, created_at, thread_id, forum_threads(title)")
          .eq("author_id", id).order("created_at", { ascending: false }).limit(10));
        const stats = await optional(async () => check(await sb.from("forum_user_stats").select("post_count").eq("user_id", id).maybeSingle()), null);
        if (!prof && !posts.length) return null;
        return {
          id,
          name: prof?.display_name || posts[0]?.author_name || "?",
          avatar: prof?.avatar_url || "",
          role: prof?.role || "member", banned: !!prof?.banned, bio: prof?.bio || "",
          createdAt: prof?.created_at, postCount: stats?.post_count ?? posts.length,
          recent: posts.map((p) => ({ id: p.id, text: p.body, date: p.created_at, threadId: p.thread_id, threadTitle: p.forum_threads?.title || "" })),
        };
      },
      async updateBio(text) {
        check(await sb.from("forum_profiles").update({ bio: text || null }).eq("user_id", MavoAuth.user.id));
      },
      async likes(postIds) {
        if (!postIds.length) return {};
        return optional(async () => {
          const rows = check(await sb.rpc("forum_post_likes", { p_posts: postIds }));
          return Object.fromEntries(rows.map((r) => [r.post_id, { likes: Number(r.likes), mine: r.mine }]));
        }, null);
      },
      async toggleLike(postId, liked) {
        if (liked) check(await sb.from("forum_likes").delete().eq("post_id", postId).eq("user_id", MavoAuth.user.id));
        else check(await sb.from("forum_likes").insert({ post_id: postId }));
      },
      async notifications() {
        if (!MavoAuth.user) return [];
        return optional(async () => check(await sb.from("forum_notifications").select("*")
          .order("created_at", { ascending: false }).limit(30)), []);
      },
      async markRead() {
        await optional(async () => check(await sb.from("forum_notifications").update({ read: true }).eq("read", false)), null);
      },
      async setRole(userId, role) { check(await sb.rpc("admin_set_role", { p_user: userId, p_role: role })); },
      async setBanned(userId, banned) { check(await sb.rpc("admin_set_banned", { p_user: userId, p_banned: banned })); },
    };
  }

  /* ==========================================================
     Hilfsfunktionen für die Darstellung
     ========================================================== */
  let store = createLocalStore();
  const view = $("#forumView");
  const crumbs = $("#forumCrumbs");
  const userBox = $("#forumUser");

  const locale = () => (getLang() === "en" ? "en-GB" : "de-DE");
  const fmtDate = (iso) => new Date(iso).toLocaleString(locale(),
    { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  function ago(iso) {
    const s = Math.round((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return t("gerade eben");
    const m = Math.round(s / 60); if (m < 60) return t("vor {n} Min.", { n: m });
    const h = Math.round(m / 60); if (h < 24) return t("vor {n} Std.", { n: h });
    const d = Math.round(h / 24); if (d < 7) return d === 1 ? t("gestern") : t("vor {n} Tagen", { n: d });
    return new Date(iso).toLocaleDateString(locale(), { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  const catTitle = (c) => t(c.title);
  const go = (hash) => { location.hash = hash; };
  const avatarHtml = (name, url, cls = "avatar") => url
    ? `<img class="${cls}" src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="${cls} avatar--letter">${esc((name || "?")[0].toUpperCase())}</span>`;
  const roleBadge = (role) => ROLE_LABEL[role] ? `<span class="role role--${role}">${ROLE_LABEL[role]}</span>` : "";
  const userLink = (id, name) => store.mode === "supabase" || id
    ? `<a class="user-link" href="#forum/user/${encodeURIComponent(id)}">${esc(name)}</a>` : esc(name);

  // Gelesen-Markierungen (pro Gerät)
  const SEEN_KEY = "mavo_forum_seen";
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch { /* egal */ }
  if (!seen._since) seen._since = new Date().toISOString();
  const saveSeen = () => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* egal */ } };
  const isUnread = (th) => new Date(th.lastAt) > new Date(seen[th.id] || seen._since);
  const markSeen = (id) => { seen[id] = new Date().toISOString(); saveSeen(); };
  saveSeen();

  const composer = (name, placeholder, value = "") => `
    <div class="md-editor">
      ${mdToolbar()}
      <textarea name="${name}" maxlength="5000" placeholder="${esc(placeholder)}" required>${esc(value)}</textarea>
    </div>`;

  function pager(page, total, per, base) {
    const last = lastPage(total, per);
    if (last <= 1) return "";
    const btn = (p, label = p) => p === page
      ? `<span class="pager__item is-active">${label}</span>`
      : `<a class="pager__item" href="${base}/${p}">${label}</a>`;
    const nums = [];
    for (let p = 1; p <= last; p++) {
      if (p === 1 || p === last || Math.abs(p - page) <= 1) nums.push(btn(p));
      else if (nums.at(-1) !== "…") nums.push("…");
    }
    return `<nav class="pager">${page > 1 ? btn(page - 1, "‹") : ""}${nums.map((n) => n === "…" ? '<span class="pager__gap">…</span>' : n).join("")}${page < last ? btn(page + 1, "›") : ""}</nav>`;
  }

  function errorBox(err) {
    console.error(err);
    view.innerHTML = `<div class="empty">${icon("alert")} ${t("Das Forum konnte nicht geladen werden.")}<br><small>${esc(err?.message || err)}</small></div>`;
  }
  async function guard(fn) {
    try { await fn(); } catch (err) { errorBox(err); }
  }

  function setCrumbs(items) {
    crumbs.innerHTML = items
      .map((it, i) => (it.hash && i < items.length - 1 ? `<a href="${it.hash}">${esc(it.label)}</a>` : `<span>${esc(it.label)}</span>`))
      .join(`<span class="sep">${icon("chevron-down")}</span>`);
  }

  async function requireLogin() {
    if (store.user()) return true;
    if (store.mode === "supabase") {
      if (confirm(t("Zum Schreiben musst du dich mit Discord anmelden. Jetzt anmelden?"))) await store.login();
      return false;
    }
    await store.login();
    renderUser();
    return !!store.user();
  }

  /* ---------- Kopfbereich: Benutzer + Benachrichtigungen ---------- */
  let notes = [];
  function renderUser() {
    const u = store.user();
    const unread = notes.filter((n) => !n.read).length;
    userBox.innerHTML = u
      ? `<div class="forum-me">
           ${store.mode === "supabase" ? `
           <div class="notif">
             <button class="icon-btn notif__btn" data-action="notif" aria-label="${t("Benachrichtigungen")}" aria-expanded="false">
               ${icon("bell")}${unread ? `<span class="notif__count">${unread > 9 ? "9+" : unread}</span>` : ""}
             </button>
             <div class="notif__panel" hidden></div>
           </div>` : ""}
           <a class="forum-me__profile" href="#forum/user/${encodeURIComponent(u.id)}">
             ${avatarHtml(u.name, u.avatar, "avatar avatar--sm")}
             <span><strong>${esc(u.name)}</strong>${u.isAdmin ? ` ${roleBadge("admin")}` : ""}</span>
           </a>
           <button class="btn btn--ghost btn--sm" data-action="logout">${t("Abmelden")}</button>
         </div>`
      : `<button class="btn ${store.mode === "supabase" ? "btn--discord" : "btn--ghost"}" data-action="login">
           ${store.mode === "supabase" ? `${icon("discord")} ${t("Mit Discord anmelden")}` : t("Namen festlegen")}</button>`;
  }

  function renderNotes() {
    const panel = $(".notif__panel", userBox);
    if (!panel) return;
    panel.innerHTML = `
      <div class="notif__head"><strong>${t("Benachrichtigungen")}</strong>
        ${notes.some((n) => !n.read) ? `<button class="link-btn" data-action="read-all">${t("Alle gelesen")}</button>` : ""}</div>
      ${notes.length ? notes.map((n) => n.kind === "application" ? `
        <a class="notif__item ${n.read ? "" : "is-unread"}" href="#fraktionen">
          <span class="notif__icon">${icon("file")}</span>
          <span><strong>${t("Bewerbung")}</strong> ${esc(n.title)}<small>${ago(n.created_at)}</small></span>
        </a>` : `
        <a class="notif__item ${n.read ? "" : "is-unread"}" href="#forum/thread/${esc(n.thread_id)}/last">
          <span class="notif__icon">${icon(n.kind === "like" ? "heart" : "chat")}</span>
          <span><strong>${esc(n.actor_name)}</strong> ${n.kind === "like" ? t("gefällt dein Beitrag in") : t("hat geantwortet in")}
            „${esc(n.title)}“<small>${ago(n.created_at)}</small></span>
        </a>`).join("") : `<p class="notif__empty">${t("Keine Benachrichtigungen.")}</p>`}`;
  }

  async function loadNotes() {
    if (store.mode !== "supabase" || !store.user()) { notes = []; return; }
    notes = await store.notifications();
    const open = !$(".notif__panel", userBox)?.hidden;
    renderUser();
    if (open) { $(".notif__panel", userBox).hidden = false; renderNotes(); }
  }

  userBox.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "login") { await guard(() => store.login()); renderUser(); route(); }
    if (action === "logout") { await store.logout(); notes = []; renderUser(); route(); showToast(t("Abgemeldet.")); }
    if (action === "notif") {
      const panel = $(".notif__panel", userBox);
      panel.hidden = !panel.hidden;
      e.target.closest("[data-action]").setAttribute("aria-expanded", !panel.hidden);
      if (!panel.hidden) renderNotes();
    }
    if (action === "read-all") {
      await store.markRead();
      notes.forEach((n) => (n.read = true));
      renderUser(); $(".notif__panel", userBox).hidden = false; renderNotes();
    }
    if (e.target.closest(".notif__item")) $(".notif__panel", userBox).hidden = true;
  });
  document.addEventListener("click", (e) => {
    const panel = $(".notif__panel", userBox);
    if (panel && !panel.hidden && !e.target.closest(".notif")) panel.hidden = true;
  });

  const demoNotice = () => store.mode === "local"
    ? `<p class="forum-notice">${icon("info")} ${t("Demo-Modus: Beiträge werden nur lokal in deinem Browser gespeichert.")}</p>` : "";

  /* ---------- Status-Präfixe ---------- */
  const STATUS = {
    offen: { label: "Offen", cls: "open" },
    bearbeitung: { label: "In Bearbeitung", cls: "progress" },
    angenommen: { label: "Angenommen", cls: "ok" },
    abgelehnt: { label: "Abgelehnt", cls: "no" },
    geschlossen: { label: "Geschlossen", cls: "closed" },
  };
  const statusOf = (th) => th.status || (catById(th.category)?.statuses ? "offen" : null);
  const prefix = (status) => status && STATUS[status]
    ? `<span class="prefix prefix--${STATUS[status].cls}">${t(STATUS[status].label)}</span>` : "";

  // Kategorien nach Bereich gruppieren (Reihenfolge wie im Admin-Bereich)
  function groupedCats() {
    const groups = [];
    cats().forEach((c) => {
      const name = c.group || t("Forum");
      let g = groups.find((x) => x.name === name);
      if (!g) groups.push((g = { name, cats: [] }));
      g.cats.push(c);
    });
    return groups;
  }
  const groupOf = (c) => c?.group || "";

  function lastPostHtml(th) {
    if (!th) return `<span class="node__none">${t("Noch keine Themen")}</span>`;
    const name = th.lastAuthor || th.author;
    return `
      <a class="node__last" href="#forum/thread/${th.id}/last">
        ${avatarHtml(name, th.lastAvatar || (th.lastAuthor ? "" : th.avatar), "avatar avatar--sm")}
        <span>
          <strong>${prefix(statusOf(th))}${esc(th.title)}</strong>
          <small>${esc(name)} · ${ago(th.lastAt)}</small>
        </span>
      </a>`;
  }

  function threadRow(th, showCat = false) {
    const c = catById(th.category);
    const last = th.lastAuthor || th.author;
    return `
      <div class="thread-row ${isUnread(th) ? "is-unread" : ""}">
        ${avatarHtml(th.author, th.avatar, "avatar")}
        <span class="thread-row__main">
          <a class="thread-row__title stretched" href="#forum/thread/${th.id}">
            ${th.pinned ? `<span class="th-flag" title="${t("Angepinnt")}">${icon("pinned")}</span>` : ""}
            ${th.locked ? `<span class="th-flag" title="${t("Gesperrt")}">${icon("lock")}</span>` : ""}
            ${prefix(statusOf(th))}${esc(th.title)}
          </a>
          <span class="thread-row__meta">
            ${showCat && c ? `<span class="chip-mini">${esc(catTitle(c))}</span>` : ""}
            ${esc(th.author)} · ${ago(th.createdAt || th.lastAt)}
          </span>
        </span>
        <span class="thread-row__stat"><strong>${th.replies}</strong><small>${th.replies === 1 ? t("Antwort") : t("Antworten")}</small></span>
        <a class="thread-row__last" href="#forum/thread/${th.id}/last">
          <span><strong>${esc(last)}</strong><small>${ago(th.lastAt)}</small></span>
          ${avatarHtml(last, th.lastAvatar || (th.lastAuthor ? "" : th.avatar), "avatar avatar--sm")}
        </a>
      </div>`;
  }

  /* ---------- Ansicht: Übersicht (Bereiche mit Foren) ---------- */
  async function renderHome() {
    setCrumbs([{ label: "Forum" }]);
    const { stats, latest, totals } = await store.overview();
    const u = store.user();
    view.innerHTML = demoNotice() + `
      <div class="forum-bar">
        <label class="search-field">${icon("search")}
          <input type="search" class="input" id="forumSearch" placeholder="${t("Alle Themen durchsuchen…")}" aria-label="${t("Alle Themen durchsuchen…")}">
        </label>
        <a class="btn btn--primary" href="#forum/new">${icon("chat")} ${t("Neues Thema")}</a>
      </div>
      <div class="forum-layout">
        <div class="node-groups">${groupedCats().map((g) => `
          <section class="node-group">
            <h2 class="node-group__title">${esc(g.name)}</h2>
            <div class="node-list">
              <div class="node-list__head" aria-hidden="true">
                <span>${t("Forum")}</span><span>${t("Themen")}</span><span>${t("Beiträge")}</span><span>${t("Letzter Beitrag")}</span>
              </div>
              ${g.cats.map((c) => {
                const s = stats[c.id] || { threads: 0, posts: 0, latest: null };
                return `
                <div class="node">
                  <span class="node__icon">${iconOrText(c.icon, "chat")}</span>
                  <span class="node__main">
                    <a class="node__title stretched" href="#forum/cat/${esc(c.id)}">${esc(catTitle(c))}</a>
                    ${c.adminOnly ? `<span class="role role--admin">${t("Offiziell")}</span>` : ""}
                    <span class="node__desc">${esc(t(c.desc || ""))}</span>
                  </span>
                  <span class="node__stat"><strong>${s.threads}</strong><small>${t("Themen")}</small></span>
                  <span class="node__stat"><strong>${s.posts}</strong><small>${t("Beiträge")}</small></span>
                  ${lastPostHtml(s.latest)}
                </div>`;
              }).join("")}
            </div>
          </section>`).join("")}
        </div>
        <aside class="forum-side">
          <div class="side-card">
            <h3>${t("Neueste Aktivität")}</h3>
            ${latest.length ? latest.map((th) => `
              <a class="side-item ${isUnread(th) ? "is-unread" : ""}" href="#forum/thread/${th.id}/last">
                ${avatarHtml(th.lastAuthor || th.author, th.lastAvatar || th.avatar, "avatar avatar--sm")}
                <span><strong>${prefix(statusOf(th))}${esc(th.title)}</strong><small>${esc(th.lastAuthor || th.author)} · ${ago(th.lastAt)}</small></span>
              </a>`).join("") : `<p class="muted">${t("Noch keine Themen.")}</p>`}
          </div>
          <div class="side-card">
            <h3>${t("Forum-Statistik")}</h3>
            <div class="side-stats">
              <div><strong>${totals.threads}</strong><small>${t("Themen")}</small></div>
              <div><strong>${totals.posts}</strong><small>${t("Beiträge")}</small></div>
              ${totals.members != null ? `<div><strong>${totals.members}</strong><small>${t("Mitglieder")}</small></div>` : ""}
            </div>
          </div>
          ${!u && store.mode === "supabase" ? `
          <div class="side-card side-cta">
            <h3>${t("Mitreden?")}</h3>
            <p class="muted">${t("Melde dich mit Discord an, um Themen zu erstellen, zu antworten und Beiträge zu liken.")}</p>
            <button class="btn btn--discord btn--sm" data-login>${icon("discord")} ${t("Mit Discord anmelden")}</button>
          </div>` : ""}
        </aside>
      </div>`;
    $("#forumSearch").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.value.trim()) go(`#forum/search/${encodeURIComponent(e.target.value.trim())}`);
    });
    $("[data-login]", view)?.addEventListener("click", () => store.login());
  }

  /* ---------- Ansicht: Themenliste (Kategorie oder Suche) ---------- */
  let searchTimer;
  let sortMode = "activity";
  let statusFilter = "";
  let lastListCat = null;
  async function renderList({ catId = null, query = "", page = 1 }) {
    const cat = catId ? catById(catId) : null;
    if (catId && !cat) return renderHome();
    if (lastListCat !== catId) { statusFilter = ""; lastListCat = catId; }
    setCrumbs(cat
      ? [{ label: "Forum", hash: "#forum" }, ...(cat.group ? [{ label: cat.group, hash: "#forum" }] : []), { label: catTitle(cat) }]
      : [{ label: "Forum", hash: "#forum" }, { label: t("Suche") }]);
    const u = store.user();
    const canCreate = !cat || !cat.adminOnly || u?.isAdmin || store.mode === "local";
    const base = cat ? `#forum/cat/${cat.id}` : `#forum/search/${encodeURIComponent(query)}`;

    view.innerHTML = `
      ${cat ? `
      <div class="cat-head">
        <span class="forum-cat__icon">${iconOrText(cat.icon, "chat")}</span>
        <div>${cat.group ? `<span class="eyebrow">${esc(cat.group)}</span>` : ""}<h2>${esc(catTitle(cat))}</h2><p class="muted">${esc(t(cat.desc || ""))}</p></div>
        ${canCreate ? `<a class="btn btn--primary" href="#forum/new/${esc(cat.id)}">${icon("chat")} ${t("Neues Thema")}</a>` : ""}
      </div>` : `<div class="cat-head"><div><h2>${t("Suche")}</h2></div></div>`}
      ${cat?.statuses ? `
      <div class="chips status-chips" id="statusChips">
        <button class="chip ${!statusFilter ? "is-active" : ""}" data-status="">${t("Alle")}</button>
        ${Object.entries(STATUS).map(([k, v]) => `<button class="chip ${statusFilter === k ? "is-active" : ""}" data-status="${k}"><span class="dot dot--${v.cls}"></span>${t(v.label)}</button>`).join("")}
      </div>` : ""}
      <div class="forum-toolbar">
        <label class="search-field">${icon("search")}
          <input type="search" class="input" id="threadSearch" placeholder="${t("Themen durchsuchen…")}" value="${esc(query)}">
        </label>
        <select class="select" id="threadSort" aria-label="${t("Sortieren")}">
          <option value="activity" ${sortMode === "activity" ? "selected" : ""}>${t("Neueste Aktivität")}</option>
          <option value="new" ${sortMode === "new" ? "selected" : ""}>${t("Neueste Themen")}</option>
          <option value="replies" ${sortMode === "replies" ? "selected" : ""}>${t("Meiste Antworten")}</option>
        </select>
      </div>
      <div class="threads" id="threadList"><div class="loader">…</div></div>
      <div id="threadPager"></div>`;

    const draw = async (p, q) => {
      if (!cat && !q) { $("#threadList").innerHTML = `<div class="empty">${t("Gib einen Suchbegriff ein.")}</div>`; return; }
      const { items, total } = await store.listThreads(cat?.id || null, { page: p, q, sort: sortMode, status: statusFilter });
      $("#threadList").innerHTML = items.length
        ? `<div class="threads__head" aria-hidden="true"><span>${t("Thema")}</span><span>${t("Antworten")}</span><span>${t("Letzter Beitrag")}</span></div>`
          + items.map((th) => threadRow(th, !cat)).join("")
        : `<div class="empty">${q || statusFilter ? t("Keine Treffer.") : t("Noch keine Themen hier. Starte das erste!")}</div>`;
      $("#threadPager").innerHTML = pager(p, total, THREADS_PER_PAGE, base);
    };
    await draw(page, query);

    $("#threadSearch").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => guard(() => draw(1, e.target.value.trim())), 300);
    });
    $("#threadSort").addEventListener("change", (e) => {
      sortMode = e.target.value;
      guard(() => draw(1, $("#threadSearch").value.trim()));
    });
    $("#statusChips")?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-status]");
      if (!b) return;
      statusFilter = b.dataset.status;
      $$("#statusChips .chip").forEach((c) => c.classList.toggle("is-active", c === b));
      guard(() => draw(1, $("#threadSearch").value.trim()));
    });
  }

  /* ---------- Ansicht: Neues Thema ---------- */
  async function renderNew(catId) {
    setCrumbs([{ label: "Forum", hash: "#forum" }, { label: t("Neues Thema") }]);
    if (!(await requireLogin())) { if (store.mode === "supabase") go("#forum"); return; }
    const u = store.user();
    const allowed = cats().filter((c) => !c.adminOnly || u?.isAdmin || store.mode === "local");
    const preset = allowed.find((c) => c.id === catId) || allowed.find((c) => c.id === "allgemein") || allowed[0];

    const options = groupedCats().map((g) => {
      const list = g.cats.filter((c) => allowed.includes(c));
      return list.length ? `<optgroup label="${esc(g.name)}">${list.map((c) =>
        `<option value="${esc(c.id)}" ${c === preset ? "selected" : ""}>${esc(catTitle(c))}</option>`).join("")}</optgroup>` : "";
    }).join("");

    view.innerHTML = `
      <form class="form compose" id="newThread">
        <h2>${t("Neues Thema erstellen")}</h2>
        <label class="field"><span>${t("Forum")}</span><select class="select" name="cat">${options}</select></label>
        <p class="compose__hint" id="catHint"></p>
        <label class="field"><span>${t("Titel")}</span>
          <input name="title" class="input" minlength="3" maxlength="100" required placeholder="${t("Worum geht es?")}">
        </label>
        <div class="field"><span>${t("Beitrag")}</span>${composer("text", t("Schreib deinen Beitrag…"), preset?.template || "")}</div>
        <div class="form__preview md" hidden></div>
        <div class="form__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-preview>${t("Vorschau")}</button>
          <a class="btn btn--ghost btn--sm" href="${catId ? `#forum/cat/${esc(catId)}` : "#forum"}">${t("Abbrechen")}</a>
          <button class="btn btn--primary" data-submit>${t("Veröffentlichen")}</button>
        </div>
      </form>`;
    const form = $("#newThread");
    let lastTemplate = preset?.template || "";
    const showHint = () => {
      const c = catById(form.elements.cat.value);
      $("#catHint").innerHTML = c?.template
        ? `${icon("info")} ${t("Bitte fülle die Vorlage vollständig aus – unvollständige Anträge werden abgelehnt.")}`
        : c?.desc ? `${icon("info")} ${esc(t(c.desc))}` : "";
    };
    showHint();
    form.elements.cat.addEventListener("change", () => {
      const c = catById(form.elements.cat.value);
      const ta = form.elements.text;
      // Vorlage nur ersetzen, wenn noch nichts Eigenes geschrieben wurde
      if (!ta.value.trim() || ta.value === lastTemplate) { ta.value = c?.template || ""; lastTemplate = ta.value; }
      showHint();
    });
    form.elements.title.focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = form.elements.title.value.trim();
      const text = form.elements.text.value.trim();
      if (title.length < 3 || !text) return;
      if (lastTemplate && text === lastTemplate.trim()) return showToast(t("Bitte fülle die Vorlage aus."));
      const btn = $("[data-submit]", form);
      btn.disabled = true;
      try {
        const id = await store.createThread(form.elements.cat.value, title, text);
        showToast(t("Thema erstellt!"));
        go(`#forum/thread/${id}`);
      } catch (err) {
        showToast(t("Fehler") + ": " + (err.message || err));
        btn.disabled = false;
      }
    });
  }

  /* ---------- Ansicht: Thema ---------- */
  async function renderThread(threadId, page = 1) {
    const data = await store.getThread(threadId, page);
    if (!data) { showToast(t("Thema nicht gefunden.")); return go("#forum"); }
    const { thread: th, posts, total, offset } = data;
    const cat = catById(th.category) || { id: th.category, title: th.category, desc: "" };
    const u = store.user();
    setCrumbs([{ label: "Forum", hash: "#forum" }, ...(cat.group ? [{ label: cat.group, hash: "#forum" }] : []),
      { label: catTitle(cat), hash: `#forum/cat/${cat.id}` }, { label: th.title }]);
    markSeen(threadId);

    const ids = [...new Set([...posts.map((p) => p.authorId), ...(u ? [u.id] : [])])];
    const [profiles, likes] = await Promise.all([store.profiles(ids), store.likes(posts.map((p) => p.id))]);
    const isTeam = !!(u && (u.isAdmin || ["team", "admin"].includes(profiles[u.id]?.role)));
    const status = statusOf(th);

    const statusBar = isTeam && (cat.statuses || th.status) ? `
      <div class="admin-bar status-bar">
        <span>${icon("flag")} ${t("Status")}</span>
        ${Object.entries(STATUS).map(([k, v]) => `
          <button class="btn btn--ghost btn--sm ${status === k ? "is-current" : ""}" data-setstatus="${k}">
            <span class="dot dot--${v.cls}"></span>${t(v.label)}</button>`).join("")}
      </div>` : "";

    const adminBar = statusBar + (u?.isAdmin ? `
      <div class="admin-bar">
        <span>${icon("shield")} Admin</span>
        <button class="btn btn--ghost btn--sm" data-admin="pin">${icon("pinned")} ${th.pinned ? t("Lösen") : t("Anpinnen")}</button>
        <button class="btn btn--ghost btn--sm" data-admin="lock">${icon("lock")} ${th.locked ? t("Entsperren") : t("Sperren")}</button>
        <button class="btn btn--ghost btn--sm btn--danger" data-admin="delete">${icon("x")} ${t("Thema löschen")}</button>
      </div>` : "");

    const canReply = !th.locked || u?.isAdmin;
    const pagerHtml = pager(data.page, total, POSTS_PER_PAGE, `#forum/thread/${threadId}`);

    view.innerHTML = `
      <header class="thread-head">
        <a class="chip-mini" href="#forum/cat/${esc(cat.id)}">${iconOrText(cat.icon, "chat")} ${esc(catTitle(cat))}</a>
        <h2>${th.pinned ? `<span class="th-flag">${icon("pinned")}</span>` : ""}${th.locked ? `<span class="th-flag">${icon("lock")}</span>` : ""}${prefix(status)}${esc(th.title)}</h2>
        <p class="muted">${t("von")} ${userLink(th.authorId, th.author)} · ${fmtDate(th.createdAt)} · ${total - 1} ${total - 1 === 1 ? t("Antwort") : t("Antworten")}</p>
      </header>
      ${adminBar}
      ${pagerHtml}
      <div class="posts">${posts.map((p, i) => {
        const index = offset + i;
        const own = u && p.authorId === u.id;
        const prof = profiles[p.authorId] || {};
        const like = likes?.[p.id] || { likes: 0, mine: false };
        return `
        <article class="post ${index === 0 ? "post--first" : ""}" id="post-${esc(p.id)}">
          <aside class="post__author">
            <a href="#forum/user/${encodeURIComponent(p.authorId)}">${avatarHtml(p.author, prof.avatar || p.avatar, "avatar avatar--lg")}</a>
            <div class="post__who">
              ${userLink(p.authorId, prof.name || p.author)}
              <div class="post__badges">${roleBadge(prof.role)}${prof.banned ? `<span class="role role--banned">${t("Gesperrt")}</span>` : ""}</div>
              ${prof.postCount != null ? `<small>${t(rankOf(prof.postCount))} · ${prof.postCount} ${prof.postCount === 1 ? t("Beitrag") : t("Beiträge")}</small>` : ""}
            </div>
          </aside>
          <div class="post__body">
            <div class="post__date">
              <span>${ago(p.date)}${index === 0 ? ` · ${t("Themenstart")}` : ""}${p.edited ? ` · <em>${t("bearbeitet")}</em>` : ""}</span>
              <span class="post__num">#${index + 1}</span>
            </div>
            <div class="post__text md" data-text="${esc(p.id)}">${renderMarkdown(p.text)}</div>
            <div class="post__actions">
              ${likes !== null ? `<button class="react ${like.mine ? "is-on" : ""}" data-like="${esc(p.id)}" data-mine="${like.mine ? 1 : 0}" ${own ? "disabled" : ""} aria-pressed="${like.mine}" title="${t("Gefällt mir")}">
                ${icon("heart")}<span>${like.likes || ""}</span></button>` : ""}
              ${canReply ? `<button data-quote="${esc(p.id)}">${icon("chat")} ${t("Zitieren")}</button>` : ""}
              ${own || u?.isAdmin ? `<button data-edit="${esc(p.id)}">${icon("file")} ${t("Bearbeiten")}</button>` : ""}
              ${u && !own ? `<button data-report="${esc(p.id)}">${icon("flag")} ${t("Melden")}</button>` : ""}
              ${u && index > 0 && (own || u.isAdmin) ? `<button class="danger" data-del="${esc(p.id)}">${icon("x")} ${t("Löschen")}</button>` : ""}
            </div>
          </div>
        </article>`;
      }).join("")}
      </div>
      ${pagerHtml}
      ${canReply ? `
        <form class="form compose" id="replyForm">
          <div class="compose__head">
            ${u ? avatarHtml(u.name, u.avatar, "avatar avatar--sm") : ""}
            <h3>${t("Antworten")}</h3>
          </div>
          ${u || store.mode === "local" ? `
            ${composer("text", t("Deine Antwort…"))}
            <div class="form__preview md" hidden></div>
            <div class="form__actions">
              <button type="button" class="btn btn--ghost btn--sm" data-preview>${t("Vorschau")}</button>
              <button class="btn btn--primary" data-submit>${icon("chat")} ${t("Antwort senden")}</button>
            </div>`
          : `<p class="muted">${t("Melde dich an, um zu antworten.")}</p>
             <div><button type="button" class="btn btn--discord" data-login>${icon("discord")} ${t("Mit Discord anmelden")}</button></div>`}
        </form>` : `<div class="empty">${icon("lock")} ${t("Dieses Thema ist gesperrt.")}</div>`}`;

    const postById = (id) => posts.find((p) => p.id === id);
    $("[data-login]", view)?.addEventListener("click", () => store.login());

    $$("[data-like]", view).forEach((b) => b.addEventListener("click", async () => {
      if (!(await requireLogin())) return;
      const mine = b.dataset.mine === "1";
      const countEl = $("span", b);
      const n = (parseInt(countEl.textContent, 10) || 0) + (mine ? -1 : 1);
      // sofort anzeigen, dann speichern
      b.dataset.mine = mine ? "0" : "1"; b.classList.toggle("is-on", !mine); countEl.textContent = n || "";
      try { await store.toggleLike(b.dataset.like, mine); }
      catch (err) {
        b.dataset.mine = mine ? "1" : "0"; b.classList.toggle("is-on", mine); countEl.textContent = (n + (mine ? 1 : -1)) || "";
        showToast(t("Fehler") + ": " + (err.message || err));
      }
    }));

    $$("[data-quote]", view).forEach((b) => b.addEventListener("click", () => {
      const p = postById(b.dataset.quote);
      const ta = $("#replyForm textarea");
      if (!ta) return requireLogin();
      const quoted = p.text.split("\n").filter((l) => !l.startsWith(">")).slice(0, 8).map((l) => `> ${l}`).join("\n");
      ta.value = `${ta.value ? ta.value.trimEnd() + "\n\n" : ""}> **${p.author}** ${t("schrieb")}:\n${quoted}\n\n`;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      ta.scrollIntoView({ behavior: "smooth", block: "center" });
    }));

    $$("[data-del]", view).forEach((b) =>
      b.addEventListener("click", () => guard(async () => {
        if (!confirm(t("Beitrag wirklich löschen?"))) return;
        await store.deletePost(threadId, b.dataset.del);
        await renderThread(threadId, data.page);
      })));

    $$("[data-report]", view).forEach((b) =>
      b.addEventListener("click", async () => {
        const reason = (prompt(t("Warum möchtest du diesen Beitrag melden?")) || "").trim();
        if (reason.length < 3) return;
        try {
          await store.report(b.dataset.report, reason.slice(0, 500));
          showToast(t("Danke! Das Team schaut sich den Beitrag an."));
        } catch (err) { showToast(err.message || String(err)); }
      }));

    $$("[data-edit]", view).forEach((b) =>
      b.addEventListener("click", () => {
        const p = postById(b.dataset.edit);
        const box = view.querySelector(`[data-text="${CSS.escape(p.id)}"]`);
        box.innerHTML = `
          <form class="form form--inline">
            ${composer("text", "", p.text)}
            <div class="form__actions">
              <button type="button" class="btn btn--ghost btn--sm" data-cancel>${t("Abbrechen")}</button>
              <button class="btn btn--primary btn--sm">${t("Speichern")}</button>
            </div>
          </form>`;
        const form = $("form", box);
        form.elements.text.focus();
        $("[data-cancel]", form).addEventListener("click", () => (box.innerHTML = renderMarkdown(p.text)));
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const text = form.elements.text.value.trim();
          if (!text) return;
          guard(async () => {
            await store.editPost(threadId, p.id, text);
            showToast(t("Gespeichert."));
            await renderThread(threadId, data.page);
          });
        });
      }));

    $$("[data-setstatus]", view).forEach((b) => b.addEventListener("click", () => guard(async () => {
      await store.setStatus(threadId, b.dataset.setstatus);
      showToast(t("Status geändert: {s}", { s: t(STATUS[b.dataset.setstatus].label) }));
      await renderThread(threadId, data.page);
    })));

    $$("[data-admin]", view).forEach((b) =>
      b.addEventListener("click", () => guard(async () => {
        const a = b.dataset.admin;
        if (a === "pin") await store.setPinned(threadId, !th.pinned);
        if (a === "lock") await store.setLocked(threadId, !th.locked);
        if (a === "delete") {
          if (!confirm(t("Ganzes Thema inkl. aller Antworten löschen?"))) return;
          await store.deleteThread(threadId);
          return go(`#forum/cat/${cat.id}`);
        }
        await renderThread(threadId, data.page);
      })));

    $("#replyForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!(await requireLogin())) return;
      const text = e.target.elements.text.value.trim();
      if (!text) return;
      const btn = $("[data-submit]", e.target);
      btn.disabled = true;
      try {
        await store.reply(threadId, text);
        showToast(t("Antwort gesendet!"));
        const target = `#forum/thread/${threadId}/last`;
        if (location.hash === target) await renderThread(threadId, "last"); else go(target);
        requestAnimationFrame(() => $$(".post").at(-1)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      } catch (err) {
        showToast(t("Fehler") + ": " + (err.message || err));
        btn.disabled = false;
      }
    });
  }

  /* ---------- Ansicht: Profil ---------- */
  async function renderProfile(userId) {
    const prof = await store.getProfile(userId);
    setCrumbs([{ label: "Forum", hash: "#forum" }, { label: prof?.name || t("Profil") }]);
    if (!prof) { view.innerHTML = `<div class="empty">${t("Profil nicht gefunden.")}</div>`; return; }
    const u = store.user();
    const own = u && u.id === userId;

    view.innerHTML = `
      <section class="profile">
        <div class="profile__head">
          ${avatarHtml(prof.name, prof.avatar, "avatar avatar--xl")}
          <div>
            <h2>${esc(prof.name)}</h2>
            <div class="post__badges">${roleBadge(prof.role)}<span class="role">${t(rankOf(prof.postCount))}</span>${prof.banned ? `<span class="role role--banned">${t("Gesperrt")}</span>` : ""}</div>
            <p class="muted">${prof.postCount} ${prof.postCount === 1 ? t("Beitrag") : t("Beiträge")}${prof.createdAt ? ` · ${t("Mitglied seit")} ${new Date(prof.createdAt).toLocaleDateString(locale(), { month: "long", year: "numeric" })}` : ""}</p>
          </div>
        </div>
        <div class="profile__bio">
          ${prof.bio ? `<div class="md">${renderMarkdown(prof.bio)}</div>` : `<p class="muted">${own ? t("Erzähl etwas über dich oder deinen Charakter.") : t("Noch keine Beschreibung.")}</p>`}
          ${own ? `<div class="btn-row">
            ${store.mode === "supabase" ? `<button class="btn btn--ghost btn--sm" data-bio>${icon("file")} ${t("Beschreibung bearbeiten")}</button>` : ""}
            <button class="btn btn--ghost btn--sm" data-logout>${t("Abmelden")}</button></div>` : ""}
        </div>
        ${u?.isAdmin && !own && store.mode === "supabase" ? `
          <div class="admin-bar">
            <span>${icon("shield")} Admin</span>
            <label class="inline-field">${t("Rolle")}
              <select class="select select--sm" data-role>
                ${["member", "team", "admin"].map((r) => `<option value="${r}" ${prof.role === r ? "selected" : ""}>${{ member: t("Mitglied"), team: "Team", admin: "Admin" }[r]}</option>`).join("")}
              </select>
            </label>
            <button class="btn btn--ghost btn--sm ${prof.banned ? "" : "btn--danger"}" data-ban>${prof.banned ? t("Entsperren") : t("Im Forum sperren")}</button>
          </div>` : ""}
      </section>
      <div id="profileChars"></div>
      <h3 class="profile__title">${t("Letzte Beiträge")}</h3>
      <div class="profile-posts">${prof.recent.length ? prof.recent.map((p) => `
        <a class="profile-post" href="#forum/thread/${esc(p.threadId)}">
          <strong>${esc(p.threadTitle)}</strong>
          <span class="muted">${esc(p.text.replace(/[#>*_`\[\]!()]/g, "").slice(0, 160))}${p.text.length > 160 ? "…" : ""}</span>
          <small>${ago(p.date)}</small>
        </a>`).join("") : `<div class="empty">${t("Noch keine Beiträge.")}</div>`}</div>`;

    if (store.mode === "supabase") window.renderProfileCharacters?.(userId, $("#profileChars", view));
    $("[data-logout]", view)?.addEventListener("click", async () => { await store.logout(); notes = []; renderUser(); showToast(t("Abgemeldet.")); go("#forum"); });
    $("[data-bio]", view)?.addEventListener("click", () => {
      const box = $(".profile__bio", view);
      box.innerHTML = `
        <form class="form form--inline">
          ${composer("text", t("Erzähl etwas über dich oder deinen Charakter."), prof.bio)}
          <div class="form__actions">
            <button type="button" class="btn btn--ghost btn--sm" data-cancel>${t("Abbrechen")}</button>
            <button class="btn btn--primary btn--sm">${t("Speichern")}</button>
          </div>
        </form>`;
      const form = $("form", box);
      form.elements.text.required = false;
      form.elements.text.maxLength = 500;
      $("[data-cancel]", form).addEventListener("click", () => renderProfile(userId));
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        guard(async () => { await store.updateBio(form.elements.text.value.trim()); showToast(t("Gespeichert.")); await renderProfile(userId); });
      });
    });
    $("[data-role]", view)?.addEventListener("change", (e) => guard(async () => {
      await store.setRole(userId, e.target.value);
      showToast(t("Rolle geändert."));
      await renderProfile(userId);
    }));
    $("[data-ban]", view)?.addEventListener("click", () => guard(async () => {
      if (!prof.banned && !confirm(t("{n} im Forum sperren? Die Person kann dann nichts mehr schreiben.", { n: prof.name }))) return;
      await store.setBanned(userId, !prof.banned);
      showToast(prof.banned ? t("Entsperrt.") : t("Gesperrt."));
      await renderProfile(userId);
    }));
  }

  // Vorschau-Button in allen Forum-Formularen
  view.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preview]");
    if (!btn) return;
    const form = btn.closest("form");
    const prev = $(".form__preview", form);
    prev.hidden = !prev.hidden;
    prev.innerHTML = renderMarkdown(form.elements.text.value) || `<p class="muted">${t("Noch nichts geschrieben.")}</p>`;
    btn.textContent = prev.hidden ? t("Vorschau") : t("Vorschau ausblenden");
  });

  /* ---------- Router ---------- */
  let ready = false;
  function route() {
    if (!ready) return;
    const [tab, type, id, p] = (location.hash.slice(1) || document.body.dataset.page || "").split("/");
    if (tab !== "forum") return;
    const page = p === "last" ? "last" : Math.max(1, parseInt(p, 10) || 1);
    const did = decodeURIComponent(id || "");
    if (type === "cat") guard(() => renderList({ catId: did, page: page === "last" ? 1 : page }));
    else if (type === "search") guard(() => renderList({ query: did, page: page === "last" ? 1 : page }));
    else if (type === "thread") guard(() => renderThread(did, page));
    else if (type === "user") guard(() => renderProfile(did));
    else if (type === "new") guard(() => renderNew(did));
    else guard(renderHome);
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("tabchange", (e) => e.detail === "forum" && route());
  document.addEventListener("langchange", () => { if (ready) { renderUser(); route(); } });
  MavoAuth.onChange(() => { if (ready) { renderUser(); route(); loadNotes(); } });

  (async () => {
    const sb = await getSupabase();
    if (sb) {
      store = createSupabaseStore(sb);
      await MavoAuth.ready;
    }
    await contentReady;
    ready = true;
    renderUser();
    route();
    loadNotes();
    setInterval(loadNotes, 60_000);
  })();

  // Für den Admin-Bereich
  window.forumRank = rankOf;
})();
