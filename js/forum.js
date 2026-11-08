/* ==========================================================
   Mavo City – Forum
   Routen:  #forum                        -> Kategorien
            #forum/cat/<id>[/<seite>]     -> Themen einer Kategorie
            #forum/thread/<id>[/<seite>]  -> Beiträge eines Themas

   Zwei Speicher-Varianten mit gleicher Schnittstelle:
   - SupabaseStore: echtes Forum mit Discord-Login (js/supabase.js)
   - LocalStore:    Demo-Modus, speichert nur im eigenen Browser
   ========================================================== */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const esc = window.escapeHtml;
  const THREADS_PER_PAGE = 20;
  const POSTS_PER_PAGE = 15;
  const COOLDOWN_MS = 20_000;

  const pageOf = (items, page, per) => items.slice((page - 1) * per, page * per);
  const lastPage = (total, per) => Math.max(1, Math.ceil(total / per));

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
    let lastPostAt = 0;

    const cooldown = () => {
      if (Date.now() - lastPostAt < COOLDOWN_MS) throw new Error(t("Bitte warte 20 Sekunden zwischen zwei Beiträgen."));
      lastPostAt = Date.now();
    };
    const summary = (t) => ({
      id: t.id, title: t.title, pinned: !!t.pinned, locked: !!t.locked,
      author: t.posts[0]?.author || "?", lastAt: lastDate(t), replies: Math.max(0, t.posts.length - 1),
    });
    const find = (id) => threads.find((x) => x.id === id);

    return {
      mode: "local",
      user: () => (name ? { id: name, name, avatar: "", isAdmin: false } : null),
      async login() {
        const n = (prompt(t("Dein Name im Forum (z.B. dein Discord- oder Charaktername):"), name) || "").trim().slice(0, 32);
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
      async listThreads(cat, { page, q }) {
        const all = threads.filter((t) => t.cat === cat && t.title.toLowerCase().includes(q.toLowerCase())).map(summary)
          .sort((a, b) => (b.pinned - a.pinned) || (new Date(b.lastAt) - new Date(a.lastAt)));
        return { items: pageOf(all, page, THREADS_PER_PAGE), total: all.length };
      },
      async getThread(id, page) {
        const t = find(id);
        if (!t) return null;
        const total = t.posts.length;
        const p = page === "last" ? lastPage(total, POSTS_PER_PAGE) : page;
        return {
          thread: { ...summary(t), category: t.cat },
          posts: pageOf(t.posts, p, POSTS_PER_PAGE).map((x) => ({
            id: x.id, author: x.author, authorId: x.author, avatar: "", date: x.date, edited: x.edited, text: x.text,
          })),
          total, page: p, offset: (p - 1) * POSTS_PER_PAGE,
        };
      },
      async createThread(cat, title, text) {
        cooldown();
        const t = { id: uid(), cat, pinned: false, title, posts: [{ id: uid(), author: name, date: new Date().toISOString(), text }] };
        threads.push(t); save();
        return t.id;
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
        const t = find(threadId);
        t.posts = t.posts.filter((p) => p.id !== postId); save();
      },
      async report() { throw new Error(t("Melden ist im Demo-Modus nicht verfügbar.")); },
      async setPinned() {}, async setLocked() {}, async deleteThread() {},
    };
  }

  /* ==========================================================
     Speicher: Supabase (echtes Forum, Login mit Discord)
     Datenbank-Schema: supabase/schema.sql
     ========================================================== */
  function createSupabaseStore(sb) {
    const check = ({ data, error }) => { if (error) throw error; return data; };
    const toSummary = (t) => ({
      id: t.id, title: t.title, pinned: t.pinned, locked: t.locked,
      author: t.author_name, lastAt: t.last_post_at, replies: t.reply_count,
    });
    const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => "\\" + c);

    return {
      mode: "supabase",
      user: () => MavoAuth.user,
      login: () => MavoAuth.login(),
      logout: () => MavoAuth.logout(),
      async categoryStats() {
        const rows = check(await sb.from("forum_threads").select("category, reply_count"));
        const stats = {};
        rows.forEach((r) => {
          const s = (stats[r.category] ||= { threads: 0, posts: 0 });
          s.threads++; s.posts += r.reply_count + 1;
        });
        return stats;
      },
      async listThreads(cat, { page, q }) {
        let query = sb.from("forum_threads")
          .select("id, title, pinned, locked, author_name, last_post_at, reply_count", { count: "exact" })
          .eq("category", cat);
        if (q) query = query.ilike("title", `%${likeEscape(q)}%`);
        const from = (page - 1) * THREADS_PER_PAGE;
        const { data, count, error } = await query
          .order("pinned", { ascending: false }).order("last_post_at", { ascending: false })
          .range(from, from + THREADS_PER_PAGE - 1);
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
          thread: { ...toSummary(thread), category: thread.category },
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
      async setLocked(id, locked) { check(await sb.from("forum_threads").update({ locked }).eq("id", id)); },
      async deleteThread(id) { check(await sb.from("forum_threads").delete().eq("id", id)); },
    };
  }

  /* ==========================================================
     Darstellung
     ========================================================== */
  let store = createLocalStore();
  const view = $("#forumView");
  const crumbs = $("#forumCrumbs");
  const userBox = $("#forumUser");

  const fmtDate = (iso) => new Date(iso).toLocaleString(getLang() === "en" ? "en-GB" : "de-DE",
    { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const catById = (id) => FORUM_CATEGORIES.find((c) => c.id === id);
  const catTitle = (c) => t(c.title);
  const go = (hash) => { location.hash = hash; };
  const avatarHtml = (name, url, cls) => url
    ? `<img class="${cls}" src="${esc(url)}" alt="" width="52" height="52" loading="lazy">`
    : `<div class="${cls}">${esc((name || "?")[0].toUpperCase())}</div>`;
  const formatHint = () => `<span class="form__hint">${t("Formatierung")}: <code>**${t("fett")}**</code> <code>*${t("kursiv")}*</code> <code>[Link](https://…)</code> <code>![Bild](https://…)</code> <code>&gt; ${t("Zitat")}</code> <code>- ${t("Liste")}</code></span>`;

  function pager(page, total, per, base) {
    const last = lastPage(total, per);
    if (last <= 1) return "";
    const btn = (p, label = p) => p === page
      ? `<span class="pager__item is-active">${label}</span>`
      : `<a class="pager__item" href="${base}/${p}">${label}</a>`;
    const nums = [];
    for (let p = 1; p <= last; p++) {
      if (p === 1 || p === last || Math.abs(p - page) <= 2) nums.push(btn(p));
      else if (nums.at(-1) !== "…") nums.push("…");
    }
    return `<nav class="pager">${page > 1 ? btn(page - 1, "‹") : ""}${nums.map((n) => n === "…" ? '<span class="pager__gap">…</span>' : n).join("")}${page < last ? btn(page + 1, "›") : ""}</nav>`;
  }

  function errorBox(err) {
    console.error(err);
    view.innerHTML = `<div class="empty">⚠️ ${t("Das Forum konnte nicht geladen werden.")}<br><small>${esc(err?.message || err)}</small></div>`;
  }
  async function guard(fn) {
    try { await fn(); } catch (err) { errorBox(err); }
  }

  /* ---------- Benutzer-Box ---------- */
  function renderUser() {
    const u = store.user();
    userBox.innerHTML = u
      ? `${avatarHtml(u.name, u.avatar, "forum-user__avatar")}
         <span>${t("Angemeldet als")} <strong>${esc(u.name)}</strong>${u.isAdmin ? ' <span class="tag tag--ok">Admin</span>' : ""}</span>
         <button class="btn btn--ghost btn--sm" data-action="logout">${t("Abmelden")}</button>`
      : `<span>${t("Nicht angemeldet")}</span>
         <button class="btn ${store.mode === "supabase" ? "btn--discord" : "btn--ghost"} btn--sm" data-action="login">${
           store.mode === "supabase" ? t("Mit Discord anmelden") : t("Namen festlegen")}</button>`;
  }

  userBox.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "login") { await guard(() => store.login()); renderUser(); route(); }
    if (action === "logout") { await store.logout(); renderUser(); route(); showToast(t("Abgemeldet.")); }
  });

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

  function setCrumbs(items) {
    crumbs.innerHTML = items
      .map((it, i) => (it.hash && i < items.length - 1 ? `<a href="${it.hash}">${esc(it.label)}</a>` : `<span>${esc(it.label)}</span>`))
      .join('<span class="sep">/</span>');
  }

  const demoNotice = () => store.mode === "local"
    ? `<p class="forum-notice">ℹ️ ${t("Demo-Modus: Beiträge werden nur lokal in deinem Browser gespeichert.")}</p>` : "";

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
            <span class="forum-cat__title">${esc(catTitle(c))}</span>
            <span class="forum-cat__desc">${esc(t(c.desc))}</span>
          </span>
          <span class="forum-cat__meta"><strong>${s.threads}</strong>${t("Themen")} · ${s.posts} ${t("Beiträge")}</span>
        </a>`;
    }).join("")}</div>`;
  }

  /* ---------- Ansicht: Themen einer Kategorie ---------- */
  let searchTimer;
  async function renderCategory(catId, page = 1, q = "") {
    const cat = catById(catId);
    if (!cat) return renderCategories();
    setCrumbs([{ label: "Forum", hash: "#forum" }, { label: catTitle(cat) }]);
    const u = store.user();
    const canCreate = catId !== "news" || u?.isAdmin || store.mode === "local";

    view.innerHTML = `
      <div class="forum-toolbar">
        <input type="search" id="threadSearch" placeholder="${t("Themen durchsuchen…")}" aria-label="${t("Themen durchsuchen…")}" value="${esc(q)}">
        ${canCreate ? `<button class="btn btn--primary btn--sm" id="newThreadBtn">+ ${t("Neues Thema")}</button>` : ""}
      </div>
      <div id="newThreadForm"></div>
      <div class="threads" id="threadList"><div class="loader">…</div></div>
      <div id="threadPager"></div>`;

    const draw = async (p, query) => {
      const { items, total } = await store.listThreads(catId, { page: p, q: query });
      $("#threadList").innerHTML = items.length
        ? items.map((th) => `
          <a class="thread-row" href="#forum/thread/${th.id}">
            <span>
              <span class="thread-row__title">${th.pinned ? '<span class="pin">📌</span>' : ""}${th.locked ? '<span class="pin">🔒</span>' : ""}${esc(th.title)}</span>
              <span class="thread-row__meta">${t("von")} ${esc(th.author)} · ${t("zuletzt")} ${fmtDate(th.lastAt)}</span>
            </span>
            <span class="thread-row__count">${th.replies} ${th.replies === 1 ? t("Antwort") : t("Antworten")}</span>
          </a>`).join("")
        : `<div class="empty">${query ? t("Keine Treffer.") : t("Noch keine Themen hier. Starte das erste!")}</div>`;
      $("#threadPager").innerHTML = pager(p, total, THREADS_PER_PAGE, `#forum/cat/${catId}`);
    };
    await draw(page, q);

    $("#threadSearch").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => guard(() => draw(1, e.target.value.trim())), 300);
    });

    $("#newThreadBtn")?.addEventListener("click", async () => {
      if (!(await requireLogin())) return;
      const wrap = $("#newThreadForm");
      wrap.innerHTML = `
        <form class="form" style="margin-bottom:16px">
          <h3>${t("Neues Thema in „{c}“", { c: catTitle(cat) })}</h3>
          <input name="title" minlength="3" maxlength="100" placeholder="${t("Titel")}" required>
          <textarea name="text" maxlength="5000" placeholder="${t("Dein Beitrag…")}" required></textarea>
          ${formatHint()}
          <div class="form__preview md" hidden></div>
          <div class="form__actions">
            <button type="button" class="btn btn--ghost btn--sm" data-preview>${t("Vorschau")}</button>
            <button type="button" class="btn btn--ghost btn--sm" data-cancel>${t("Abbrechen")}</button>
            <button class="btn btn--primary btn--sm" data-submit>${t("Veröffentlichen")}</button>
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
        const btn = form.querySelector("[data-submit]");
        btn.disabled = true;
        try {
          const id = await store.createThread(catId, title, text);
          showToast(t("Thema erstellt!"));
          go(`#forum/thread/${id}`);
        } catch (err) {
          showToast(t("Fehler") + ": " + (err.message || err));
          btn.disabled = false;
        }
      });
    });
  }

  /* ---------- Ansicht: Thema ---------- */
  async function renderThread(threadId, page = 1) {
    const data = await store.getThread(threadId, page);
    if (!data) { showToast(t("Thema nicht gefunden.")); return go("#forum"); }
    const { thread: th, posts, total, offset } = data;
    const cat = catById(th.category) || { id: th.category, title: th.category, desc: "" };
    const u = store.user();
    setCrumbs([{ label: "Forum", hash: "#forum" }, { label: catTitle(cat), hash: `#forum/cat/${cat.id}` }, { label: th.title }]);

    const adminBar = u?.isAdmin ? `
      <div class="admin-bar">
        <span>Admin:</span>
        <button class="btn btn--ghost btn--sm" data-admin="pin">${th.pinned ? t("Lösen") : t("Anpinnen")}</button>
        <button class="btn btn--ghost btn--sm" data-admin="lock">${th.locked ? t("Entsperren") : t("Sperren")}</button>
        <button class="btn btn--ghost btn--sm btn--danger" data-admin="delete">${t("Thema löschen")}</button>
      </div>` : "";

    const canReply = !th.locked || u?.isAdmin;
    const pagerHtml = pager(data.page, total, POSTS_PER_PAGE, `#forum/thread/${threadId}`);

    view.innerHTML = `
      <h2>${th.pinned ? "📌 " : ""}${th.locked ? "🔒 " : ""}${esc(th.title)}</h2>
      ${adminBar}
      ${pagerHtml}
      <div class="posts">${posts.map((p, i) => {
        const index = offset + i;
        const own = u && p.authorId === u.id;
        return `
        <article class="post" id="post-${esc(p.id)}">
          <div class="post__author">
            ${avatarHtml(p.author, p.avatar, "post__avatar")}
            <div class="post__name">${esc(p.author)}</div>
          </div>
          <div class="post__body">
            <div class="post__date">
              <span>${fmtDate(p.date)}${index === 0 ? ` · ${t("Themenstart")}` : ""}${p.edited ? ` · <em>${t("bearbeitet")}</em>` : ""}</span>
              <span class="post__actions">
                ${own || u?.isAdmin ? `<button data-edit="${esc(p.id)}">${t("Bearbeiten")}</button>` : ""}
                ${u && !own ? `<button data-report="${esc(p.id)}">${t("Melden")}</button>` : ""}
                ${u && index > 0 && (own || u.isAdmin) ? `<button class="post__delete" data-del="${esc(p.id)}">${t("Löschen")}</button>` : ""}
              </span>
            </div>
            <div class="post__text md" data-text="${esc(p.id)}">${renderMarkdown(p.text)}</div>
          </div>
        </article>`;
      }).join("")}
      </div>
      ${pagerHtml}
      ${canReply ? `
        <form class="form" id="replyForm">
          <h3>${t("Antworten")}</h3>
          <textarea name="text" maxlength="5000" placeholder="${u ? t("Deine Antwort…") : t("Melde dich an, um zu antworten.")}" required></textarea>
          ${formatHint()}
          <div class="form__preview md" hidden></div>
          <div class="form__actions">
            <button type="button" class="btn btn--ghost btn--sm" data-preview>${t("Vorschau")}</button>
            <button class="btn btn--primary btn--sm" data-submit>${t("Antwort senden")}</button>
          </div>
        </form>` : `<div class="empty">🔒 ${t("Dieses Thema ist gesperrt.")}</div>`}`;

    const postById = (id) => posts.find((p) => p.id === id);

    view.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => guard(async () => {
        if (!confirm(t("Beitrag wirklich löschen?"))) return;
        await store.deletePost(threadId, b.dataset.del);
        await renderThread(threadId, data.page);
      })));

    view.querySelectorAll("[data-report]").forEach((b) =>
      b.addEventListener("click", async () => {
        const reason = (prompt(t("Warum möchtest du diesen Beitrag melden?")) || "").trim();
        if (reason.length < 3) return;
        try {
          await store.report(b.dataset.report, reason.slice(0, 500));
          showToast(t("Danke! Das Team schaut sich den Beitrag an."));
        } catch (err) { showToast(err.message || String(err)); }
      }));

    view.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => {
        const p = postById(b.dataset.edit);
        const box = view.querySelector(`[data-text="${CSS.escape(p.id)}"]`);
        box.innerHTML = `
          <form class="form form--inline">
            <textarea name="text" maxlength="5000" required>${esc(p.text)}</textarea>
            <div class="form__actions">
              <button type="button" class="btn btn--ghost btn--sm" data-cancel>${t("Abbrechen")}</button>
              <button class="btn btn--primary btn--sm">${t("Speichern")}</button>
            </div>
          </form>`;
        const form = box.querySelector("form");
        form.elements.text.focus();
        form.querySelector("[data-cancel]").addEventListener("click", () => (box.innerHTML = renderMarkdown(p.text)));
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

    view.querySelectorAll("[data-admin]").forEach((b) =>
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
      const btn = e.target.querySelector("[data-submit]");
      btn.disabled = true;
      try {
        await store.reply(threadId, text);
        showToast(t("Antwort gesendet!"));
        const target = `#forum/thread/${threadId}/last`;
        if (location.hash === target) await renderThread(threadId, "last"); else go(target);
      } catch (err) {
        showToast(t("Fehler") + ": " + (err.message || err));
        btn.disabled = false;
      }
    });
  }

  // Vorschau-Button in allen Forum-Formularen
  view.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preview]");
    if (!btn) return;
    const form = btn.closest("form");
    const prev = form.querySelector(".form__preview");
    prev.hidden = !prev.hidden;
    prev.innerHTML = renderMarkdown(form.elements.text.value) || `<p class="muted">${t("Noch nichts geschrieben.")}</p>`;
    btn.textContent = prev.hidden ? t("Vorschau") : t("Vorschau ausblenden");
  });

  /* ---------- Router ---------- */
  let ready = false;
  function route() {
    if (!ready) return;
    const [tab, type, id, p] = location.hash.slice(1).split("/");
    if (tab !== "forum") return;
    const page = p === "last" ? "last" : Math.max(1, parseInt(p, 10) || 1);
    if (type === "cat") guard(() => renderCategory(id, page === "last" ? 1 : page));
    else if (type === "thread") guard(() => renderThread(id, page));
    else guard(renderCategories);
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("tabchange", (e) => e.detail === "forum" && route());
  document.addEventListener("langchange", () => { if (ready) { renderUser(); route(); } });
  MavoAuth.onChange(() => { if (ready) { renderUser(); route(); } });

  (async () => {
    const sb = await getSupabase();
    if (sb) {
      store = createSupabaseStore(sb);
      await MavoAuth.ready;
    }
    ready = true;
    renderUser();
    route();
  })();
})();
