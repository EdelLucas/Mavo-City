/* ==========================================================
   Mavo City – Streamer
   Live-Erkennung über die Supabase-Funktion "twitch-live"
   (nur wenn CONFIG.twitchLiveCheck = true und Supabase eingerichtet).
   Der Twitch-Player wird erst nach Klick geladen (Datenschutz).
   ========================================================== */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const esc = window.escapeHtml;
  let live = {};
  let checked = false;

  const channel = (s) => String(s.twitch || "").toLowerCase().trim();

  async function loadLive() {
    if (!CONFIG.twitchLiveCheck || !CONFIG.supabaseUrl || !CONTENT.streamers.length) return;
    try {
      const channels = CONTENT.streamers.map(channel).filter(Boolean).join(",");
      const res = await fetch(`${CONFIG.supabaseUrl}/functions/v1/twitch-live?channels=${encodeURIComponent(channels)}`, {
        headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${CONFIG.supabaseAnonKey}` },
      });
      if (!res.ok) throw new Error(res.status);
      live = (await res.json()).live || {};
      checked = true;
      render();
    } catch (err) {
      console.warn("Twitch-Live-Status nicht verfügbar", err);
    }
  }

  function render() {
    const list = [...CONTENT.streamers].sort((a, b) => !!live[channel(b)] - !!live[channel(a)]);
    $("#streamerGrid").innerHTML = list.map((s) => {
      const info = live[channel(s)];
      return `
        <article class="card streamer ${info ? "streamer--live" : ""}">
          ${info
            ? `<button class="streamer__thumb" data-watch="${esc(channel(s))}" aria-label="${t("Stream ansehen")}">
                 <img src="${esc(info.thumbnail)}" alt="" loading="lazy"><span class="live-badge">LIVE</span>
                 <span class="streamer__viewers">${icon("eye")} ${Number(info.viewers) || 0}</span>
               </button>`
            : ""}
          <div class="streamer__head">
            <div class="member__avatar streamer__avatar">${esc((s.name || "?")[0])}</div>
            <div>
              <h3>${esc(s.name)}</h3>
              <span class="tag ${info ? "tag--live" : ""}">${info ? "● LIVE" : checked ? t("Offline") : `${icon("twitch")} Twitch`}</span>
            </div>
          </div>
          ${info ? `<p class="streamer__title">${esc(info.title)}</p>` : s.desc ? `<p>${esc(s.desc)}</p>` : ""}
          <div class="btn-row">
            ${channel(s) ? `<button class="btn btn--primary btn--sm" data-watch="${esc(channel(s))}">${t("Stream ansehen")}</button>
            <a class="btn btn--ghost btn--sm" href="https://twitch.tv/${encodeURIComponent(channel(s))}" target="_blank" rel="noopener">twitch.tv ${icon("external")}</a>` : ""}
          </div>
        </article>`;
    }).join("") || `<div class="empty">${t("Noch keine Streamer eingetragen.")}</div>`;
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-watch]");
    if (!btn) return;
    const ch = btn.dataset.watch;
    const parent = location.hostname || "localhost";
    $("#streamPlayer").innerHTML = `
      <div class="stream-player">
        <div class="stream-player__head">
          <strong>twitch.tv/${esc(ch)}</strong>
          <button class="btn btn--ghost btn--sm" data-close-stream>${t("Schließen")}</button>
        </div>
        <iframe src="https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=${encodeURIComponent(parent)}&autoplay=true"
          allowfullscreen title="Twitch ${esc(ch)}"></iframe>
      </div>`;
    $("#streamPlayer").scrollIntoView({ behavior: "smooth" });
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-stream]")) $("#streamPlayer").innerHTML = "";
  });

  contentReady.then(() => { render(); loadLive(); setInterval(loadLive, 120_000); });
  document.addEventListener("langchange", render);
})();
