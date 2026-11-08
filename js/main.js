/* ==========================================================
   Mavo City – Hauptlogik: Tabs, Verbinden, Status, Discord
   ========================================================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- Globale Helfer ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  window.escapeHtml = esc;

  let toastTimer;
  window.showToast = (msg) => {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2800);
  };

  /* ---------- Farbschema (Hell / Dunkel) ---------- */
  const themeBtn = $("#themeSwitch");
  function applyTheme(theme) {
    if (theme === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    const light = theme === "light";
    themeBtn.innerHTML = icon(light ? "moon" : "sun");
    themeBtn.title = light ? t("Dunkles Design") : t("Helles Design");
    document.querySelector('meta[name="theme-color"]').content = light ? "#f7f6f3" : "#0a0a0b";
  }
  const currentTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
  themeBtn.addEventListener("click", () => {
    const next = currentTheme() === "light" ? "dark" : "light";
    try { localStorage.setItem("mavo_theme", next); } catch { /* egal */ }
    applyTheme(next);
  });
  applyTheme(currentTheme());
  document.addEventListener("langchange", () => applyTheme(currentTheme()));

  /* ---------- Tab-System (mit URL-Hash, z.B. #forum oder #wiki/jobs) ---------- */
  const tabs = $$(".tab[data-tab]");
  const panels = $$(".panel");
  const nav = $("#mainNav");
  const menuBtn = $("#menuBtn");
  const groups = $$(".nav-group");
  const bottomItems = $$("[data-bottom-tab]");
  const validTabs = panels.map((p) => p.id);
  let currentTab = null;

  const closeGroups = (except) => groups.forEach((g) => {
    if (g === except) return;
    g.classList.remove("is-open");
    $(".nav-group__btn", g).setAttribute("aria-expanded", "false");
  });
  const setMenu = (open) => {
    nav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.classList.toggle("is-active", open);
    document.body.style.overflow = open ? "hidden" : "";
  };

  function setTitle(name) {
    const tab = $(`.tab[data-tab="${name}"]`);
    document.title = name === "start" || !tab
      ? `Mavo City – FiveM Roleplay`
      : `${tab.textContent.trim()} – Mavo City`;
  }

  function openTab(name, { updateHash = true } = {}) {
    if (!validTabs.includes(name)) name = "start";
    const changed = name !== currentTab;
    currentTab = name;

    tabs.forEach((t) => {
      const active = t.dataset.tab === name;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active);
    });
    // Gruppe hervorheben, wenn ein Tab daraus aktiv ist
    groups.forEach((g) => $(".nav-group__btn", g).classList.toggle("is-active", !!$(`[data-tab="${name}"]`, g)));
    bottomItems.forEach((b) => b.classList.toggle("is-active", b.dataset.bottomTab === name));
    panels.forEach((p) => (p.hidden = p.id !== name));

    if (updateHash && location.hash !== "#" + name) history.pushState(null, "", "#" + name);

    setMenu(false);
    closeGroups();
    if (changed) window.scrollTo({ top: 0, behavior: "instant" });
    setTitle(name);
    document.dispatchEvent(new CustomEvent("tabchange", { detail: name }));
  }

  tabs.forEach((t) => t.addEventListener("click", () => openTab(t.dataset.tab)));
  bottomItems.forEach((b) => b.addEventListener("click", () => openTab(b.dataset.bottomTab)));
  menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));

  groups.forEach((g) => {
    const btn = $(".nav-group__btn", g);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !g.classList.contains("is-open");
      closeGroups(g);
      g.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open);
    });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".nav-group")) closeGroups(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeGroups(); setMenu(false); } });

  // Alle Links mit data-tab-link öffnen den passenden Tab
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-tab-link]");
    if (!link) return;
    e.preventDefault();
    openTab(link.dataset.tabLink);
  });

  const tabFromHash = () => decodeURIComponent(location.hash.slice(1).split("/")[0]) || "start";
  // Unterseiten (z.B. #forum/thread/…) behandeln die Module selbst über "hashchange"
  const syncTab = () => { if (tabFromHash() !== currentTab) openTab(tabFromHash(), { updateHash: false }); };
  window.addEventListener("popstate", syncTab);
  window.addEventListener("hashchange", syncTab);
  document.addEventListener("langchange", () => setTitle(currentTab));
  window.openTab = openTab;
  openTab(tabFromHash(), { updateHash: false });
  // Der Browser springt bei Links wie #fraktionen sonst zum Abschnitt statt nach oben
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("load", () => window.scrollTo(0, 0));

  /* ---------- Scroll-Animationen ----------
     Karten, Überschriften usw. blenden sanft ein, sobald sie sichtbar werden. */
  const REVEAL = ".section__title, .card, .news__item, .event, .step, .accordion details, .release, .gallery__item, .cta-banner, .discord-card";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const io = !reduce && "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      }), { rootMargin: "0px 0px -40px 0px", threshold: 0.05 })
    : null;
  let scanQueued = false;
  function scanReveal() {
    scanQueued = false;
    if (!io) return;
    $$(REVEAL).forEach((el, i) => {
      if (el.dataset.reveal || el.closest("[hidden]")) return;
      el.dataset.reveal = "1";
      // Elemente, die schon im Bild sind, nicht nachträglich ausblenden
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) return;
      el.classList.add("reveal");
      el.style.transitionDelay = `${(i % 3) * 70}ms`;
      io.observe(el);
    });
  }
  new MutationObserver(() => { if (!scanQueued) { scanQueued = true; requestAnimationFrame(scanReveal); } })
    .observe(document.querySelector("main"), { childList: true, subtree: true });
  document.addEventListener("tabchange", () => requestAnimationFrame(scanReveal));
  requestAnimationFrame(scanReveal);

  /* ---------- Links aus der Config ---------- */
  $$(".js-discord").forEach((a) => (a.href = CONFIG.discordUrl));
  $("#year").textContent = new Date().getFullYear();

  const socials = [["TikTok", CONFIG.tiktokUrl], ["YouTube", CONFIG.youtubeUrl], ["Instagram", CONFIG.instagramUrl]];
  socials.filter(([, url]) => url).forEach(([label, url]) => {
    $("#footerLinks").insertAdjacentHTML("afterbegin", `<a href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`);
  });

  /* ---------- Verbinden ---------- */
  const connectCmd = `connect ${CONFIG.connectAddress}`;
  $("#connectCmd").textContent = connectCmd;
  // fivem:// öffnet FiveM direkt und verbindet zum Server
  $("#joinBtn").href = CONFIG.cfxCode
    ? `fivem://connect/cfx.re/join/${CONFIG.cfxCode}`
    : `fivem://connect/${CONFIG.connectAddress}`;

  $("#copyConnect").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(connectCmd);
      showToast(t("Befehl kopiert – jetzt in F8 einfügen!"));
    } catch {
      showToast(t("Kopieren nicht möglich – bitte manuell markieren."));
    }
  });

  /* ---------- Hintergrund: Video oder Bilder (wechseln alle 7 Sekunden) ---------- */
  contentReady.then(() => {
    const box = $("#heroSlides");
    const hero = $(".hero");
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (CONFIG.heroVideo && !reduceMotion) {
      box.innerHTML = `<video class="hero__video" src="${esc(CONFIG.heroVideo)}" autoplay muted loop playsinline preload="metadata"
        ${CONFIG.heroVideoPoster ? `poster="${esc(CONFIG.heroVideoPoster)}"` : ""}></video>`;
      hero.classList.add("hero--images");
      return;
    }
    const imgs = (CONTENT.hero || []).map((h) => h.src).filter(Boolean);
    if (!imgs.length) return;
    box.innerHTML = imgs.map((src, i) =>
      `<div class="hero__slide${i === 0 ? " is-active" : ""}" style="background-image:url('${esc(src).replace(/'/g, "%27")}')"></div>`).join("");
    hero.classList.add("hero--images");
    if (imgs.length < 2 || reduceMotion) return;
    let i = 0;
    setInterval(() => {
      const slides = box.children;
      slides[i].classList.remove("is-active");
      i = (i + 1) % slides.length;
      slides[i].classList.add("is-active");
    }, 7000);
  });

  /* ---------- Live-Serverstatus + Spielerliste (FiveM-API) ---------- */
  const dot = $("#statusDot");
  const statusText = $("#statusText");
  $("#statMax").textContent = CONFIG.maxPlayers;
  let status = "loading";

  function renderStatusText() {
    statusText.textContent = {
      loading: t("Status wird geladen…"),
      online: t("Server online"),
      unknown: t("Status unbekannt"),
      none: "German Roleplay",
    }[status];
  }
  document.addEventListener("langchange", renderStatusText);

  async function loadStatus() {
    if (!CONFIG.liveStatus || !CONFIG.cfxCode) { status = "none"; return renderStatusText(); }
    try {
      const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${encodeURIComponent(CONFIG.cfxCode)}`);
      if (!res.ok) throw new Error(res.status);
      const { Data } = await res.json();
      dot.className = "dot is-online";
      status = "online";
      $("#statPlayers").textContent = Data.clients ?? 0;
      $("#statMax").textContent = Data.sv_maxclients ?? CONFIG.maxPlayers;

      const players = (Data.players || []).map((p) => p.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
      const list = $("#playerList");
      list.hidden = !CONFIG.showPlayerList || !players.length;
      $("#playerListItems").innerHTML = players.map((n) => `<li>${esc(n)}</li>`).join("");
    } catch {
      dot.className = "dot";
      status = "unknown";
    }
    renderStatusText();
  }
  renderStatusText();
  loadStatus();
  setInterval(loadStatus, 60_000);

  /* ---------- Discord-Widget ----------
     Nutzt die öffentliche widget.json – funktioniert nur, wenn im Discord
     unter Servereinstellungen → Widget das Server-Widget aktiviert ist. */
  let discordCount = null;
  const renderDiscordCount = () => {
    if (discordCount !== null) $("#discordOnline").textContent = t("{n} Mitglieder online", { n: discordCount });
  };
  document.addEventListener("langchange", renderDiscordCount);

  async function loadDiscord() {
    if (!CONFIG.discordServerId) return;
    try {
      const res = await fetch(`https://discord.com/api/guilds/${encodeURIComponent(CONFIG.discordServerId)}/widget.json`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      $("#discordName").textContent = data.name;
      discordCount = data.presence_count;
      renderDiscordCount();
      $("#discordMembers").innerHTML = (data.members || []).slice(0, 12).map((m) =>
        `<img src="${esc(m.avatar_url)}" alt="${esc(m.username)}" title="${esc(m.username)}" width="32" height="32" loading="lazy">`
      ).join("");
      if (data.instant_invite && (!CONFIG.discordUrl || CONFIG.discordUrl.includes("DEIN-INVITE"))) {
        $$(".js-discord").forEach((a) => (a.href = data.instant_invite));
      }
    } catch { /* Widget deaktiviert oder nicht erreichbar – Standardtext bleibt */ }
  }
  loadDiscord();
})();
