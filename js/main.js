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
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2500);
  };

  /* ---------- Tab-System (mit URL-Hash, z.B. #forum) ---------- */
  const tabs = $$(".tab[data-tab]");
  const panels = $$(".panel");
  const nav = $(".tabs");
  const navToggle = $(".nav-toggle");
  const more = $(".tab-more");
  const moreBtn = $(".tab-more__btn");
  const validTabs = panels.map((p) => p.id);

  const closeMore = () => {
    more.classList.remove("is-open");
    moreBtn.setAttribute("aria-expanded", "false");
  };

  function openTab(name, { updateHash = true } = {}) {
    if (!validTabs.includes(name)) name = "start";

    tabs.forEach((t) => {
      const active = t.dataset.tab === name;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active);
    });
    // "Mehr" hervorheben, wenn ein Tab daraus aktiv ist
    moreBtn.classList.toggle("is-active", !!$(`.tab-more__menu [data-tab="${name}"]`));
    panels.forEach((p) => (p.hidden = p.id !== name));

    if (updateHash && location.hash !== "#" + name) history.pushState(null, "", "#" + name);

    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    closeMore();
    window.scrollTo({ top: 0 });
    document.dispatchEvent(new CustomEvent("tabchange", { detail: name }));
  }

  tabs.forEach((t) => t.addEventListener("click", () => openTab(t.dataset.tab)));

  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = more.classList.toggle("is-open");
    moreBtn.setAttribute("aria-expanded", open);
  });
  document.addEventListener("click", (e) => { if (!more.contains(e.target)) closeMore(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMore(); });

  // Alle Links mit data-tab-link öffnen den passenden Tab
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-tab-link]");
    if (!link) return;
    e.preventDefault();
    openTab(link.dataset.tabLink);
  });

  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", open);
  });

  const tabFromHash = () => location.hash.slice(1).split("/")[0] || "start";
  window.addEventListener("popstate", () => openTab(tabFromHash(), { updateHash: false }));
  window.openTab = openTab;
  openTab(tabFromHash(), { updateHash: false });

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
      showToast("Befehl kopiert – jetzt in F8 einfügen!");
    } catch {
      showToast("Kopieren nicht möglich – bitte manuell markieren.");
    }
  });

  /* ---------- Live-Serverstatus (FiveM-API) ---------- */
  const dot = $("#statusDot");
  const statusText = $("#statusText");
  $("#statMax").textContent = CONFIG.maxPlayers;

  async function loadStatus() {
    if (!CONFIG.liveStatus || !CONFIG.cfxCode) {
      statusText.textContent = "German Roleplay";
      return;
    }
    try {
      const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${CONFIG.cfxCode}`);
      if (!res.ok) throw new Error(res.status);
      const { Data } = await res.json();
      dot.className = "dot is-online";
      statusText.textContent = "Server online";
      $("#statPlayers").textContent = Data.clients ?? 0;
      $("#statMax").textContent = Data.sv_maxclients ?? CONFIG.maxPlayers;
    } catch {
      dot.className = "dot";
      statusText.textContent = "Status unbekannt";
    }
  }
  loadStatus();
  setInterval(loadStatus, 60_000);

  /* ---------- Discord-Widget ----------
     Nutzt die öffentliche widget.json – funktioniert nur, wenn im Discord
     unter Servereinstellungen → Widget das Server-Widget aktiviert ist. */
  async function loadDiscord() {
    if (!CONFIG.discordServerId) return;
    try {
      const res = await fetch(`https://discord.com/api/guilds/${CONFIG.discordServerId}/widget.json`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      $("#discordName").textContent = data.name;
      $("#discordOnline").textContent = `${data.presence_count} Mitglieder online`;
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
