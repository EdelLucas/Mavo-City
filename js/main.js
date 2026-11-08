/* ==========================================================
   Mavo City – Hauptlogik: Tabs, Verbinden, Status, Inhalte
   ========================================================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- Toast (global nutzbar) ---------- */
  let toastTimer;
  window.showToast = (msg) => {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2500);
  };

  /* ---------- Tab-System (mit URL-Hash, z.B. #forum) ---------- */
  const tabs = $$(".tab");
  const panels = $$(".panel");
  const nav = $(".tabs");
  const navToggle = $(".nav-toggle");
  const validTabs = panels.map((p) => p.id);

  function openTab(name, { updateHash = true } = {}) {
    if (!validTabs.includes(name)) name = "start";

    tabs.forEach((t) => {
      const active = t.dataset.tab === name;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active);
    });
    panels.forEach((p) => (p.hidden = p.id !== name));

    if (updateHash && location.hash !== "#" + name) {
      history.pushState(null, "", "#" + name);
    }
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0 });
    document.dispatchEvent(new CustomEvent("tabchange", { detail: name }));
  }

  tabs.forEach((t) => t.addEventListener("click", () => openTab(t.dataset.tab)));

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
  openTab(tabFromHash(), { updateHash: false });

  /* ---------- Links aus der Config ---------- */
  $$(".js-discord").forEach((a) => (a.href = CONFIG.discordUrl));
  $("#year").textContent = new Date().getFullYear();

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

  /* ---------- News & Team rendern ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  window.escapeHtml = esc;

  $("#newsList").innerHTML = NEWS.map((n) => `
    <article class="news__item">
      <span class="news__date">${esc(n.date)}</span>
      <div><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p></div>
    </article>`).join("");

  $("#teamGrid").innerHTML = TEAM.map((m) => `
    <article class="card member">
      <div class="member__avatar">${esc(m.name[0])}</div>
      <h3>${esc(m.name)}</h3>
      <span class="member__role">${esc(m.role)}</span>
    </article>`).join("");

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
})();
