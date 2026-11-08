/* ==========================================================
   Mavo City – Forum
   Routen:  #forum                 -> Kategorien
            #forum/cat/<id>        -> Threads einer Kategorie
            #forum/thread/<id>     -> Beiträge eines Threads

   HINWEIS: Die Daten werden im localStorage des Browsers gespeichert.
   Das ist eine Demo/Frontend-Basis – andere Besucher sehen diese
   Beiträge NICHT. Für ein echtes Forum muss die Klasse `Store`
   gegen ein Backend (z.B. Supabase, Firebase oder eigene API)
   getauscht werden. Die Darstellung bleibt dabei gleich.
   ========================================================== */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const esc = window.escapeHtml;
  const STORAGE_KEY = "mavo_forum_v1";
  const USER_KEY = "mavo_forum_user";

  /* ---------- Speicher-Schicht ---------- */
  const Store = {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch { /* localStorage evtl. blockiert */ }
      return structuredClone(FORUM_SEED);
    },
    save(threads) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(threads)); } catch { /* ignorieren */ }
    },
    getUser() {
      try { return localStorage.getItem(USER_KEY) || ""; } catch { return ""; }
    },
    setUser(name) {
      try { localStorage.setItem(USER_KEY, name); } catch { /* ignorieren */ }
    },
  };

  let threads = Store.load();
  let user = Store.getUser();

  const view = $("#forumView");
  const crumbs = $("#forumCrumbs");

  /* ---------- Hilfsfunktionen ---------- */
  const fmtDate = (iso) =>
    new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const catById = (id) => FORUM_CATEGORIES.find((c) => c.id === id);
  const lastPost = (t) => t.posts[t.posts.length - 1];
  const go = (hash) => { location.hash = hash; };

  function renderUser() {
    $("#forumUserLabel").innerHTML = user ? `Angemeldet als <strong>${esc(user)}</strong>` : "Nicht angemeldet";
    $("#forumLoginBtn").textContent = user ? "Ändern" : "Namen festlegen";
  }

  function askName() {
    const name = (prompt("Dein Name im Forum (z.B. dein Discord- oder Charaktername):", user) || "").trim().slice(0, 32);
    if (name) {
      user = name;
      Store.setUser(name);
      renderUser();
      showToast(`Hallo ${name}!`);
    }
    return !!user;
  }

  function setCrumbs(items) {
    crumbs.innerHTML = items
      .map((it, i) => (it.hash && i < items.length - 1 ? `<a href="${it.hash}">${esc(it.label)}</a>` : `<span>${esc(it.label)}</span>`))
      .join('<span class="sep">/</span>');
  }

  const notice = `<p class="forum-notice">ℹ️ Demo-Modus: Beiträge werden nur lokal in deinem Browser gespeichert.</p>`;

  /* ---------- Ansicht: Kategorien ---------- */
  function renderCategories() {
    setCrumbs([{ label: "Forum" }]);
    view.innerHTML = notice + `<div class="forum-cats">${FORUM_CATEGORIES.map((c) => {
      const list = threads.filter((t) => t.cat === c.id);
      const posts = list.reduce((n, t) => n + t.posts.length, 0);
      return `
        <button class="forum-cat" data-cat="${c.id}">
          <span class="forum-cat__icon">${c.icon}</span>
          <span>
            <p class="forum-cat__title">${esc(c.title)}</p>
            <p class="forum-cat__desc">${esc(c.desc)}</p>
          </span>
          <span class="forum-cat__meta"><strong>${list.length}</strong>Themen · ${posts} Beiträge</span>
        </button>`;
    }).join("")}</div>`;

    view.querySelectorAll("[data-cat]").forEach((el) =>
      el.addEventListener("click", () => go(`#forum/cat/${el.dataset.cat}`)));
  }

  /* ---------- Ansicht: Threads einer Kategorie ---------- */
  function renderCategory(catId) {
    const cat = catById(catId);
    if (!cat) return renderCategories();
    setCrumbs([{ label: "Forum", hash: "#forum" }, { label: cat.title }]);

    view.innerHTML = `
      <div class="forum-toolbar">
        <input type="search" id="threadSearch" placeholder="Themen durchsuchen…" aria-label="Themen durchsuchen">
        <button class="btn btn--primary btn--sm" id="newThreadBtn">+ Neues Thema</button>
      </div>
      <div id="newThreadForm"></div>
      <div class="threads" id="threadList"></div>`;

    const listEl = $("#threadList");
    const draw = (q = "") => {
      const list = threads
        .filter((t) => t.cat === catId && t.title.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => (b.pinned - a.pinned) || (new Date(lastPost(b).date) - new Date(lastPost(a).date)));

      listEl.innerHTML = list.length
        ? list.map((t) => `
          <button class="thread-row" data-thread="${t.id}">
            <span>
              <p class="thread-row__title">${t.pinned ? '<span class="pin">📌</span>' : ""}${esc(t.title)}</p>
              <span class="thread-row__meta">von ${esc(t.posts[0].author)} · zuletzt ${fmtDate(lastPost(t).date)}</span>
            </span>
            <span class="thread-row__count">${t.posts.length - 1} Antworten</span>
          </button>`).join("")
        : `<div class="empty">Noch keine Themen hier. Starte das erste!</div>`;

      listEl.querySelectorAll("[data-thread]").forEach((el) =>
        el.addEventListener("click", () => go(`#forum/thread/${el.dataset.thread}`)));
    };
    draw();

    $("#threadSearch").addEventListener("input", (e) => draw(e.target.value));
    $("#newThreadBtn").addEventListener("click", () => {
      if (!user && !askName()) return;
      const wrap = $("#newThreadForm");
      wrap.innerHTML = `
        <form class="form" style="margin-bottom:16px">
          <h3>Neues Thema in „${esc(cat.title)}“</h3>
          <input name="title" maxlength="100" placeholder="Titel" required>
          <textarea name="text" maxlength="5000" placeholder="Dein Beitrag…" required></textarea>
          <div class="form__actions">
            <button type="button" class="btn btn--ghost btn--sm" data-cancel>Abbrechen</button>
            <button class="btn btn--primary btn--sm">Veröffentlichen</button>
          </div>
        </form>`;
      const form = wrap.querySelector("form");
      form.title.focus();
      form.querySelector("[data-cancel]").addEventListener("click", () => (wrap.innerHTML = ""));
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = form.title.value.trim();
        const text = form.text.value.trim();
        if (!title || !text) return;
        const t = { id: uid(), cat: catId, pinned: false, title, posts: [{ author: user, date: new Date().toISOString(), text }] };
        threads.push(t);
        Store.save(threads);
        showToast("Thema erstellt!");
        go(`#forum/thread/${t.id}`);
      });
    });
  }

  /* ---------- Ansicht: Thread ---------- */
  function renderThread(threadId) {
    const t = threads.find((x) => x.id === threadId);
    if (!t) return renderCategories();
    const cat = catById(t.cat);
    setCrumbs([{ label: "Forum", hash: "#forum" }, { label: cat.title, hash: `#forum/cat/${cat.id}` }, { label: t.title }]);

    view.innerHTML = `
      <h2>${t.pinned ? "📌 " : ""}${esc(t.title)}</h2>
      <div class="posts">${t.posts.map((p, i) => `
        <article class="post">
          <div class="post__author">
            <div class="post__avatar">${esc(p.author[0].toUpperCase())}</div>
            <div class="post__name">${esc(p.author)}</div>
          </div>
          <div class="post__body">
            <div class="post__date">
              <span>${fmtDate(p.date)}${i === 0 ? " · Themenstart" : ""}</span>
              ${user && p.author === user && i > 0 ? `<button class="post__delete" data-del="${i}">Löschen</button>` : ""}
            </div>
            <div class="post__text">${esc(p.text)}</div>
          </div>
        </article>`).join("")}
      </div>
      <form class="form" id="replyForm">
        <h3>Antworten</h3>
        <textarea name="text" maxlength="5000" placeholder="${user ? "Deine Antwort…" : "Lege zuerst einen Namen fest, um zu antworten."}" required></textarea>
        <div class="form__actions"><button class="btn btn--primary btn--sm">Antwort senden</button></div>
      </form>`;

    view.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        if (!confirm("Beitrag wirklich löschen?")) return;
        t.posts.splice(Number(b.dataset.del), 1);
        Store.save(threads);
        renderThread(threadId);
      }));

    $("#replyForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!user && !askName()) return;
      const text = e.target.text.value.trim();
      if (!text) return;
      t.posts.push({ author: user, date: new Date().toISOString(), text });
      Store.save(threads);
      showToast("Antwort gesendet!");
      renderThread(threadId);
    });
  }

  /* ---------- Router ---------- */
  function route() {
    const [tab, type, id] = location.hash.slice(1).split("/");
    if (tab !== "forum") return;
    if (type === "cat") renderCategory(id);
    else if (type === "thread") renderThread(id);
    else renderCategories();
  }

  $("#forumLoginBtn").addEventListener("click", askName);
  window.addEventListener("hashchange", route);
  document.addEventListener("tabchange", (e) => e.detail === "forum" && route());

  renderUser();
  route();
})();
