/* ==========================================================
   Mavo City – Forum
   Routen:  #forum                 -> Kategorien
            #forum/cat/<id>        -> Themen einer Kategorie
            #forum/thread/<id>     -> Beiträge eines Themas

   Zwei Speicher-Varianten mit gleicher Schnittstelle:
   - SupabaseStore: echtes Forum mit Discord-Login
     (aktiv, sobald supabaseUrl + supabaseAnonKey in js/config.js stehen)
   - LocalStore:    Demo-Modus, speichert nur im eigenen Browser
   ========================================================== */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const esc = window.escapeHtml;
  const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  const RETURN_KEY = "mavo_forum_return";

  /* ==========================================================
     Speicher: Demo-Modus (localStorage)
     ========================================================== */
  function createLocalStore() {
    const KEY = "mavo_forum_v2";
    const USER_KEY = "mavo_forum_user";
    const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
    const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* blockiert */ } };

    let threads;
    try { threads = JSON.parse(read(KEY)) || structuredClone(FORUM_SEED); } catch { threads = structuredClone(FORUM_SEED); }
    const save = () => write(KEY, JSON.stringify(threads));
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const lastDate = (t) => t.posts.at(-1)?.date || t.posts[0]?.date;
    let name = read(USER_KEY) || "";

    const summary = (t) => ({
      id: t.id, title: t.title, pinned: !!t.pinned, locked: false,
      author: t.posts[0]?.author || "?", lastAt: lastDate(t), replies: Math.max(0, t.posts.length - 1),
    });

    return {
      mode: "local",
      async init() {},
      user: () => (name ? { id: name, name, avatar: "", isAdmin: false } : null),
      async login() {
        const n = (prompt("Dein Name im Forum (z.B. dein Discord- oder Charaktername):", name) || "").trim().slice(0, 32);
        if (n) { name = n; write(USER_KEY, n); }
      },
      async logout() { name = ""; try { localStorage.removeItem(USER_KEY); } catch { /* egal */ } },
      async categoryStats() {
        const stats = {};
        threads.forEach((t) => {
          const s = (stats[t.cat] ||= { threads: 0, posts: 0 });
          s.threads++; s.posts += t.posts.length;
        });
        return stats;
      },
      async listThreads(cat) {
        return threads.filter((t) => t.cat === cat).map(summary);
      },
      async getThread(id) {
        const t = threads.find((x) => x.id === id);
        if (!t) return null;
        return {
          thread: { ...summary(t), category: t.cat },
          posts: t.posts.map((p) => ({ id: p.id, author: p.author, authorId: p.author, avatar: "", date: p.date, text: p.text })),
        };
      },
      async createThread(cat, title, text) {
        const t = { id: uid(), cat, pinned: false, title, posts: [{ id: uid(), author: name, date: new Date().toISOString(), text }] };
        threads.push(t); save();
        return t.id;
      },
      async reply(threadId, text) {
        threads.find((x) => x.id === threadId).posts.push({ id: uid(), author: name, date: new Date().toISOString(), text });
        save();
      },
      async deletePost(threadId, postId) {
        const t = threads.find((x) => x.id === threadId);
        t.posts = t.posts.filter((p) => p.id !== postId); save();
      },
      async setPinned() {}, async setLocked() {}, async deleteThread() {},
    };
  }

  /* ==========================================================
     Speicher: Supabase (echtes Forum, Login mit Discord)
     Datenbank-Schema: supabase/schema.sql
     ========================================================== */
  function createSupabaseStore() {
    let sb;
    let current = null;

    const check = ({ data, error }) => { if (error) throw error; return data; };
    const toSummary = (t) => ({
      id: t.id, title: t.title, pinned: t.pinned, locked: t.locked,
      author: t.author_name, lastAt: t.last_post_at, replies: t.reply_count,
    });

    async function loadUser(session) {
      if (!session?.user) { current = null; return; }
      const meta = session.user.user_metadata || {};
      let isAdmin = false;
      try { isAdmin = !!check(await sb.rpc("is_forum_admin")); } catch { /* kein Admin */ }
      current = {
        id: session.user.id,
        name: meta.custom_claims?.global_name || meta.full_name || meta.name || "Unbekannt",
        avatar: meta.avatar_url || "",
        isAdmin,
      };
    }

    return {
      mode: "supabase",
      async init(onAuthChange) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = SUPABASE_JS; s.onload = resolve; s.onerror = reject;
          document.head.append(s);
        });
        sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
          auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
        });
        const { data } = await sb.auth.getSession();
        await loadUser(data.session);
        sb.auth.onAuthStateChange((event, session) => {
          if (event === "INITIAL_SESSION") return;
          // Nicht direkt im Callback awaiten (Supabase-Empfehlung)
          setTimeout(async () => { await loadUser(session); onAuthChange(); }, 0);
        });
      },
      user: () => current,
      async login() {
        try { sessionStorage.setItem(RETURN_KEY, location.hash || "#forum"); } catch { /* egal */ }
        check(await sb.auth.signInWithOAuth({
          provider: "discord",
          options: { redirectTo: location.origin + location.pathname },
        }));
      },
      async logout() { await sb.auth.signOut(); current = null; },
      async categoryStats() {
        const rows = check(await sb.from("forum_threads").select("category, reply_count"));
        const stats = {};
        rows.forEach((r) => {
          const s = (stats[r.category] ||= { threads: 0, posts: 0 });
          s.threads++; s.posts += r.reply_count + 1;
        });
        return stats;
      },
      async listThreads(cat) {
        const rows = check(await sb.from("forum_threads")
          .select("id, title, pinned, locked, author_name, last_post_at, reply_count")
          .eq("category", cat).order("last_post_at", { ascending: false }).limit(200));
        return rows.map(toSummary);
      },
      async getThread(id) {
        const [t, p] = await Promise.all([
          sb.from("forum_threads").select("*").eq("id", id).maybeSingle(),
          sb.from("forum_posts").select("*").eq("thread_id", id).order("created_at"),
        ]);
        const thread = check(t);
        if (!thread) return null;
        return {
          thread: { ...toSummary(thread), category: thread.category },
          posts: check(p).map((x) => ({ id: x.id, author: x.author_name, authorId: x.author_id, avatar: x.author_avatar, date: x.created_at, text: x.body })),
        };
      },
      async createThread(cat, title, text) {
        return check(await sb.rpc("forum_create_thread", { p_category: cat, p_title: title, p_body: text }));
      },
      async reply(threadId, text) {
        check(await sb.from("forum_posts").insert({ thread_id: threadId, body: text }));
      },
      async deletePost(threadId, postId) {
        check(await sb.from("forum_posts").delete().eq("id", postId));
      },
      async setPinned(id, pinned) { check(await sb.from("forum_threads").update({ pinned }).eq("id", id)); },
      async setLocked(id, locked) { check(await sb.from("forum_threads").update({ locked }).eq("id", id)); },
      async deleteThread(id) { check(await sb.from("forum_threads").delete().eq("id", id)); },
    };
  }

  /* ==========================================================
     Darstellung
     ========================================================== */
  const useSupabase = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
  let store = useSupabase ? createSupabaseStore() : createLocalStore();

  const view = $("#forumView");
  const crumbs = $("#forumCrumbs");
  const userBox = $("#forumUser");

  const fmtDate = (iso) =>
    new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const catById = (id) => FORUM_CATEGORIES.find((c) => c.id === id);
  const go = (hash) => { location.hash = hash; };
  const avatarHtml = (name, url, cls) => url
    ? `<img class="${cls}" src="${esc(url)}" alt="" width="52" height="52" loading="lazy">`
    : `<div class="${cls}">${esc((name || "?")[0].toUpperCase())}</div>`;

  function errorBox(err) {
    console.error(err);
    view.innerHTML = `<div class="empty">⚠️ Das Forum konnte nicht geladen werden.<br><small>${esc(err?.message || err)}</small></div>`;
  }

  async function guard(fn) {
    try { await fn(); } catch (err) { errorBox(err); }
  }

  /* ---------- Benutzer-Box ---------- */
  function renderUser() {
    const u = store.user();
    const loginLabel = store.mode === "supabase" ? "Mit Discord anmelden" : "Namen festlegen";
    userBox.innerHTML = u
      ? `${avatarHtml(u.name, u.avatar, "forum-user__avatar")}
         <span>Angemeldet als <strong>${esc(u.name)}</strong>${u.isAdmin ? ' <span class="tag tag--ok">Admin</span>' : ""}</span>
         <button class="btn btn--ghost btn--sm" data-action="logout">Abmelden</button>`
      : `<span>Nicht angemeldet</span>
         <button class="btn ${store.mode === "supabase" ? "btn--discord" : "btn--ghost"} btn--sm" data-action="login">${loginLabel}</button>`;
  }

  userBox.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "login") { await guard(() => store.login()); renderUser(); route(); }
    if (action === "logout") { await store.logout(); renderUser(); route(); showToast("Abgemeldet."); }
  });

  async function requireLogin() {
    if (store.user()) return true;
    if (store.mode === "supabase") {
      if (confirm("Zum Schreiben musst du dich mit Discord anmelden. Jetzt anmelden?")) await store.login();
      return false;
    }
    await store.login();
    renderUser();
    return !!store.user();
  }

  function setCrumbs(items) {
    crumbs.innerHTML = items
      .map((it, i) => (it.hash && i < items.length - 1 ? `<a href="${it.hash}">${esc(it.label)}</a>` : `<span>${esc(it.label)}</span>`))
      .join('<span class="sep">/</span>');
  }

  const demoNotice = () => store.mode === "local"
    ? `<p class="forum-notice">ℹ️ Demo-Modus: Beiträge werden nur lokal in deinem Browser gespeichert.</p>` : "";

  /* ---------- Ansicht: Kategorien ---------- */
  async function renderCategories() {
    setCrumbs([{ label: "Forum" }]);
    const stats = await store.categoryStats();
    view.innerHTML = demoNotice() + `<div class="forum-cats">${FORUM_CATEGORIES.map((c) => {
      const s = stats[c.id] || { threads: 0, posts: 0 };
      return `
        <a class="forum-cat" href="#forum/cat/${c.id}">
          <span class="forum-cat__icon">${c.icon}</span>
          <span>
            <span class="forum-cat__title">${esc(c.title)}</span>
            <span class="forum-cat__desc">${esc(c.desc)}</span>
          </span>
          <span class="forum-cat__meta"><strong>${s.threads}</strong>Themen · ${s.posts} Beiträge</span>
        </a>`;
    }).join("")}</div>`;
  }

  /* ---------- Ansicht: Themen einer Kategorie ---------- */
  async function renderCategory(catId) {
    const cat = catById(catId);
    if (!cat) return renderCategories();
    setCrumbs([{ label: "Forum", hash: "#forum" }, { label: cat.title }]);

    const all = (await store.listThreads(catId))
      .sort((a, b) => (b.pinned - a.pinned) || (new Date(b.lastAt) - new Date(a.lastAt)));
    const u = store.user();
    const canCreate = catId !== "news" || u?.isAdmin || store.mode === "local";

    view.innerHTML = `
      <div class="forum-toolbar">
        <input type="search" id="threadSearch" placeholder="Themen durchsuchen…" aria-label="Themen durchsuchen">
        ${canCreate ? `<button class="btn btn--primary btn--sm" id="newThreadBtn">+ Neues Thema</button>` : ""}
      </div>
      <div id="newThreadForm"></div>
      <div class="threads" id="threadList"></div>`;

    const listEl = $("#threadList");
    const draw = (q = "") => {
      const list = all.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));
      listEl.innerHTML = list.length
        ? list.map((t) => `
          <a class="thread-row" href="#forum/thread/${t.id}">
            <span>
              <span class="thread-row__title">${t.pinned ? '<span class="pin">📌</span>' : ""}${t.locked ? '<span class="pin">🔒</span>' : ""}${esc(t.title)}</span>
              <span class="thread-row__meta">von ${esc(t.author)} · zuletzt ${fmtDate(t.lastAt)}</span>
            </span>
            <span class="thread-row__count">${t.replies} ${t.replies === 1 ? "Antwort" : "Antworten"}</span>
          </a>`).join("")
        : `<div class="empty">${q ? "Keine Treffer." : "Noch keine Themen hier. Starte das erste!"}</div>`;
    };
    draw();
    $("#threadSearch").addEventListener("input", (e) => draw(e.target.value));

    $("#newThreadBtn")?.addEventListener("click", async () => {
      if (!(await requireLogin())) return;
      const wrap = $("#newThreadForm");
      wrap.innerHTML = `
        <form class="form" style="margin-bottom:16px">
          <h3>Neues Thema in „${esc(cat.title)}“</h3>
          <input name="title" minlength="3" maxlength="100" placeholder="Titel" required>
          <textarea name="text" maxlength="5000" placeholder="Dein Beitrag…" required></textarea>
          <div class="form__actions">
            <button type="button" class="btn btn--ghost btn--sm" data-cancel>Abbrechen</button>
            <button class="btn btn--primary btn--sm">Veröffentlichen</button>
          </div>
        </form>`;
      const form = wrap.querySelector("form");
      form.elements.title.focus();
      form.querySelector("[data-cancel]").addEventListener("click", () => (wrap.innerHTML = ""));
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = form.elements.title.value.trim();
        const text = form.elements.text.value.trim();
        if (title.length < 3 || !text) return;
        form.querySelector("button:not([data-cancel])").disabled = true;
        try {
          const id = await store.createThread(catId, title, text);
          showToast("Thema erstellt!");
          go(`#forum/thread/${id}`);
        } catch (err) {
          showToast("Fehler: " + (err.message || err));
          form.querySelector("button:not([data-cancel])").disabled = false;
        }
      });
    });
  }

  /* ---------- Ansicht: Thema ---------- */
  async function renderThread(threadId) {
    const data = await store.getThread(threadId);
    if (!data) { showToast("Thema nicht gefunden."); return go("#forum"); }
    const { thread: t, posts } = data;
    const cat = catById(t.category) || { id: t.category, title: t.category };
    const u = store.user();
    setCrumbs([{ label: "Forum", hash: "#forum" }, { label: cat.title, hash: `#forum/cat/${cat.id}` }, { label: t.title }]);

    const adminBar = u?.isAdmin ? `
      <div class="admin-bar">
        <span>Admin:</span>
        <button class="btn btn--ghost btn--sm" data-admin="pin">${t.pinned ? "Lösen" : "Anpinnen"}</button>
        <button class="btn btn--ghost btn--sm" data-admin="lock">${t.locked ? "Entsperren" : "Sperren"}</button>
        <button class="btn btn--ghost btn--sm btn--danger" data-admin="delete">Thema löschen</button>
      </div>` : "";

    const canReply = !t.locked || u?.isAdmin;

    view.innerHTML = `
      <h2>${t.pinned ? "📌 " : ""}${t.locked ? "🔒 " : ""}${esc(t.title)}</h2>
      ${adminBar}
      <div class="posts">${posts.map((p, i) => `
        <article class="post">
          <div class="post__author">
            ${avatarHtml(p.author, p.avatar, "post__avatar")}
            <div class="post__name">${esc(p.author)}</div>
          </div>
          <div class="post__body">
            <div class="post__date">
              <span>${fmtDate(p.date)}${i === 0 ? " · Themenstart" : ""}</span>
              ${u && i > 0 && (p.authorId === u.id || u.isAdmin) ? `<button class="post__delete" data-del="${esc(p.id)}">Löschen</button>` : ""}
            </div>
            <div class="post__text">${esc(p.text)}</div>
          </div>
        </article>`).join("")}
      </div>
      ${canReply ? `
        <form class="form" id="replyForm">
          <h3>Antworten</h3>
          <textarea name="text" maxlength="5000" placeholder="${u ? "Deine Antwort…" : "Melde dich an, um zu antworten."}" required></textarea>
          <div class="form__actions"><button class="btn btn--primary btn--sm">Antwort senden</button></div>
        </form>` : `<div class="empty">🔒 Dieses Thema ist gesperrt.</div>`}`;

    view.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => guard(async () => {
        if (!confirm("Beitrag wirklich löschen?")) return;
        await store.deletePost(threadId, b.dataset.del);
        await renderThread(threadId);
      })));

    view.querySelectorAll("[data-admin]").forEach((b) =>
      b.addEventListener("click", () => guard(async () => {
        const a = b.dataset.admin;
        if (a === "pin") await store.setPinned(threadId, !t.pinned);
        if (a === "lock") await store.setLocked(threadId, !t.locked);
        if (a === "delete") {
          if (!confirm("Ganzes Thema inkl. aller Antworten löschen?")) return;
          await store.deleteThread(threadId);
          return go(`#forum/cat/${cat.id}`);
        }
        await renderThread(threadId);
      })));

    $("#replyForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!(await requireLogin())) return;
      const text = e.target.elements.text.value.trim();
      if (!text) return;
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      try {
        await store.reply(threadId, text);
        showToast("Antwort gesendet!");
        await renderThread(threadId);
      } catch (err) {
        showToast("Fehler: " + (err.message || err));
        btn.disabled = false;
      }
    });
  }

  /* ---------- Router ---------- */
  let ready = false;
  function route() {
    if (!ready) return;
    const [tab, type, id] = location.hash.slice(1).split("/");
    if (tab !== "forum") return;
    if (type === "cat") guard(() => renderCategory(id));
    else if (type === "thread") guard(() => renderThread(id));
    else guard(renderCategories);
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("tabchange", (e) => e.detail === "forum" && route());

  (async () => {
    try {
      await store.init(() => { renderUser(); route(); });
    } catch (err) {
      console.error("Supabase nicht erreichbar – Demo-Modus aktiv", err);
      store = createLocalStore();
    }
    ready = true;
    renderUser();

    // Nach dem Discord-Login zurück ins Forum
    let back = null;
    try { back = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); } catch { /* egal */ }
    if (back && store.user()) {
      history.replaceState(null, "", back);
      window.openTab("forum", { updateHash: false });
      showToast(`Willkommen, ${store.user().name}!`);
    } else {
      route();
    }
  })();
})();
