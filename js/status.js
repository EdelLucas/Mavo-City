/* ==========================================================
   Mavo City – Server-Status
   Live-Daten: öffentliche FiveM-API (über js/main.js, Ereignis "serverstatus")
   Verlauf:    Supabase-Funktion server_stats_summary (update-5-website.sql)
   Neustarts:  CONFIG.restartTimes
   ========================================================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = window.escapeHtml;
  const view = $("#statusView");
  const DAYS = () => (getLang() === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]);

  let live = "SERVER_LIVE" in window ? window.SERVER_LIVE : undefined; // undefined = lädt, null = nicht erreichbar
  let summary = null;
  let isDemo = false;
  let range = 24;

  document.addEventListener("serverstatus", (e) => { live = e.detail; if (!view.closest("[hidden]")) render(); });

  /* ---------- Neustarts (deutsche Zeit) ---------- */
  function berlinNow() {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    return Number(p.hour) * 60 + Number(p.minute);
  }
  function nextRestart() {
    const times = (CONFIG.restartTimes || []).map((s) => { const [h, m] = s.split(":").map(Number); return { s, min: h * 60 + (m || 0) }; })
      .sort((a, b) => a.min - b.min);
    if (!times.length) return null;
    const now = berlinNow();
    const next = times.find((x) => x.min > now) || times[0];
    let diff = next.min - now; if (diff <= 0) diff += 1440;
    return { times, next, diff };
  }

  /* ---------- Beispieldaten, solange es keine echten gibt ---------- */
  function demoSummary() {
    const curve = (h) => Math.max(0, Math.round(6 + 38 * Math.exp(-((h - 21) ** 2) / 18) + 10 * Math.exp(-((h - 15) ** 2) / 10)));
    const now = new Date(); now.setMinutes(0, 0, 0);
    const series = [];
    for (let i = 24 * 7 - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600_000);
      const wk = [0, 6].includes(d.getDay()) ? 1.2 : 1;
      const v = curve(d.getHours()) * wk * (0.9 + ((i * 37) % 10) / 50);
      series.push({ t: d.toISOString(), avg: Math.round(v * 10) / 10, max: Math.round(v * 1.15) });
    }
    const heat = [];
    for (let d = 1; d <= 7; d++) for (let h = 0; h < 24; h++) heat.push({ d, h, avg: curve(h) * (d >= 6 ? 1.2 : 1) });
    return { series, heat, peak_7d: Math.max(...series.map((s) => s.max)), uptime_7d: 99.6 };
  }

  async function loadSummary() {
    const sb = await getSupabase();
    if (sb) {
      const { data, error } = await sb.rpc("server_stats_summary", { p_hours: 24 * 7 });
      if (!error && data?.series?.length) { summary = data; isDemo = false; return; }
    }
    summary = demoSummary();
    isDemo = true;
  }

  /* ---------- Liniendiagramm (eine Reihe, Fadenkreuz + Tooltip) ---------- */
  function lineChart(points) {
    const W = 800, H = 240, L = 34, R = 8, T = 12, B = 26;
    if (!points.length) return `<div class="empty">${t("Noch keine Daten.")}</div>`;
    const max = Math.max(10, ...points.map((p) => p.avg));
    const top = Math.ceil(max / 10) * 10;
    const t0 = new Date(points[0].t).getTime(), t1 = new Date(points[points.length - 1].t).getTime() || t0 + 1;
    const x = (p) => L + ((new Date(p.t).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R);
    const y = (v) => T + (1 - v / top) * (H - T - B);
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)},${y(p.avg).toFixed(1)}`).join("");
    const area = `${line}L${x(points[points.length - 1]).toFixed(1)},${y(0)}L${x(points[0]).toFixed(1)},${y(0)}Z`;
    const ticksY = [0, top / 2, top];
    const lang = getLang() === "en" ? "en-GB" : "de-DE";
    const fmtX = (d) => range <= 24
      ? d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })
      : d.toLocaleDateString(lang, { weekday: "short", timeZone: "Europe/Berlin" });
    const nTicks = 6;
    const ticksX = Array.from({ length: nTicks }, (_, i) => new Date(t0 + ((t1 - t0) * i) / (nTicks - 1)));
    return `
      <div class="chart" data-chart>
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("Spieler online im Verlauf")}">
          <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
          </linearGradient></defs>
          <g class="chart__grid">${ticksY.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`).join("")}</g>
          <g class="chart__axis">
            ${ticksY.map((v) => `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("")}
            ${ticksX.map((d, i) => `<text x="${L + (i / (nTicks - 1)) * (W - L - R)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === nTicks - 1 ? "end" : "middle"}">${esc(fmtX(d))}</text>`).join("")}
          </g>
          <path class="chart__area" d="${area}"/>
          <path class="chart__line" d="${line}"/>
          <g class="chart__hover" style="display:none"><line y1="${T}" y2="${y(0)}"/><circle r="5"/></g>
          <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" data-hit/>
        </svg>
        <div class="chart__tip" hidden></div>
      </div>`;

    // (Interaktion wird nach dem Einfügen in bindChart() verdrahtet)
  }

  function bindChart(points) {
    const box = $("[data-chart]", view);
    if (!box || !points.length) return;
    const svg = $("svg", box), hover = $(".chart__hover", box), tip = $(".chart__tip", box);
    const W = 800, H = 240, L = 34, R = 8, T = 12, B = 26;
    const top = Math.ceil(Math.max(10, ...points.map((p) => p.avg)) / 10) * 10;
    const t0 = new Date(points[0].t).getTime(), t1 = new Date(points[points.length - 1].t).getTime();
    const xs = points.map((p) => L + ((new Date(p.t).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R));
    const lang = getLang() === "en" ? "en-GB" : "de-DE";
    const move = (clientX) => {
      const r = svg.getBoundingClientRect();
      const vx = ((clientX - r.left) / r.width) * W;
      let i = 0, best = Infinity;
      xs.forEach((x, k) => { const d = Math.abs(x - vx); if (d < best) { best = d; i = k; } });
      const p = points[i];
      const py = T + (1 - p.avg / top) * (H - T - B);
      hover.style.display = ""; tip.hidden = false;
      hover.querySelector("line").setAttribute("x1", xs[i]); hover.querySelector("line").setAttribute("x2", xs[i]);
      hover.querySelector("circle").setAttribute("cx", xs[i]); hover.querySelector("circle").setAttribute("cy", py);
      const when = new Date(p.t).toLocaleString(lang, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
      tip.innerHTML = `<strong>${Math.round(p.avg)} ${t("Spieler")}</strong><span>${esc(when)}</span>`;
      tip.style.left = `${(xs[i] / W) * 100}%`;
    };
    const hit = $("[data-hit]", svg);
    hit.addEventListener("pointermove", (e) => move(e.clientX));
    hit.addEventListener("pointerdown", (e) => move(e.clientX));
    svg.addEventListener("pointerleave", () => { hover.style.display = "none"; tip.hidden = true; });
  }

  /* ---------- Heatmap: Wann ist am meisten los? (eine Farbe, hell -> kräftig) ---------- */
  function heatmap(cells) {
    if (!cells.length) return `<div class="empty">${t("Noch keine Daten.")}</div>`;
    const max = Math.max(1, ...cells.map((c) => c.avg));
    const get = (d, h) => cells.find((c) => c.d === d && c.h === h)?.avg ?? 0;
    const days = DAYS();
    let html = `<div class="heat" role="table" aria-label="${t("Durchschnittliche Spielerzahl nach Wochentag und Uhrzeit")}"><span></span>`;
    for (let h = 0; h < 24; h++) html += `<span class="heat__hour">${h}</span>`;
    for (let d = 1; d <= 7; d++) {
      html += `<span class="heat__day">${days[d - 1]}</span>`;
      for (let h = 0; h < 24; h++) {
        const v = get(d, h);
        const a = v ? 0.08 + 0.92 * (v / max) : 0;
        html += `<span class="heat__cell" style="${a ? `background:color-mix(in srgb, var(--accent) ${Math.round(a * 100)}%, var(--surface-2))` : ""}"
          title="${days[d - 1]} ${String(h).padStart(2, "0")}:00 – Ø ${Math.round(v)} ${t("Spieler")}"></span>`;
      }
    }
    html += `</div>
      <div class="heat__legend">${t("wenig")}
        ${[0.1, 0.35, 0.6, 0.85, 1].map((a) => `<i style="background:color-mix(in srgb, var(--accent) ${a * 100}%, var(--surface-2))"></i>`).join("")}
        ${t("viel")}</div>`;
    // Beste Zeit als Text (für Screenreader und schnelles Lesen)
    const best = [...cells].sort((a, b) => b.avg - a.avg)[0];
    if (best?.avg) html += `<p class="muted" style="margin:12px 0 0">${t("Am meisten los")}: <strong>${days[best.d - 1]}, ${String(best.h).padStart(2, "0")}–${String((best.h + 1) % 24).padStart(2, "0")} ${t("Uhr")}</strong> (Ø ${Math.round(best.avg)} ${t("Spieler")})</p>`;
    return html;
  }

  /* ---------- Seite ---------- */
  function render() {
    const rs = nextRestart();
    const online = live && typeof live === "object";
    const players = online ? live.clients ?? 0 : null;
    const slots = online ? live.sv_maxclients ?? CONFIG.maxPlayers : CONFIG.maxPlayers;
    const names = online ? (live.players || []).map((p) => p.name).filter(Boolean).sort((a, b) => a.localeCompare(b)) : [];
    const series = summary ? summary.series.slice(-range) : [];
    const fmtDiff = (m) => (m >= 60 ? `${Math.floor(m / 60)} ${t("Std")} ${m % 60} ${t("Min")}` : `${m} ${t("Min")}`);

    view.innerHTML = `
      <div class="status-grid">
        <div class="status-card ${live === undefined ? "" : online ? "status-card--online" : "status-card--offline"}">
          <span class="status-card__label"><span class="dot ${online ? "is-online" : live === null ? "is-offline" : ""}"></span>${t("Status")}</span>
          <span class="status-card__value">${live === undefined ? "…" : online ? t("Online") : t("Nicht erreichbar")}</span>
          <span class="status-card__sub">${online ? esc(live.hostname ? live.hostname.replace(/\^\d/g, "").slice(0, 60) : CONFIG.serverName) : live === null ? t("Live-Status gerade nicht abrufbar") : t("wird geladen…")}</span>
        </div>
        <div class="status-card">
          <span class="status-card__label">${icon("users")} ${t("Spieler online")}</span>
          <span class="status-card__value">${players ?? "–"}<small class="muted" style="font-size:1rem"> / ${esc(slots)}</small></span>
          <div class="meter" aria-hidden="true"><span style="width:${players ? Math.min(100, (players / slots) * 100) : 0}%"></span></div>
        </div>
        <div class="status-card">
          <span class="status-card__label">${icon("refresh")} ${t("Nächster Neustart")}</span>
          <span class="status-card__value">${rs ? esc(rs.next.s) : "–"}</span>
          <span class="status-card__sub">${rs ? t("in {d}", { d: fmtDiff(rs.diff) }) : t("Keine festen Neustarts")}</span>
        </div>
        <div class="status-card">
          <span class="status-card__label">${icon("trophy")} ${t("Rekord (7 Tage)")}</span>
          <span class="status-card__value">${summary?.peak_7d ?? "–"}</span>
          <span class="status-card__sub">${summary?.uptime_7d != null ? t("{p} % erreichbar", { p: String(summary.uptime_7d).replace(".", getLang() === "en" ? "." : ",") }) : ""}</span>
        </div>
      </div>

      <section class="panel-box">
        <div class="panel-box__head">
          <div><h2>${t("Spieler online im Verlauf")}</h2>
            ${isDemo ? `<span class="demo-note">${icon("info")} ${t("Beispieldaten – echte Werte nach Einrichtung (siehe ANLEITUNG.md)")}</span>` : `<p>${t("Durchschnitt pro Stunde")}</p>`}</div>
          <div class="seg" role="group" aria-label="${t("Zeitraum")}">
            <button data-range="24" class="${range === 24 ? "is-active" : ""}">24 ${t("Std")}</button>
            <button data-range="168" class="${range === 168 ? "is-active" : ""}">7 ${t("Tage")}</button>
          </div>
        </div>
        ${summary ? lineChart(series) : `<div class="loader">…</div>`}
      </section>

      <div class="split split--even">
        <section class="panel-box">
          <div class="panel-box__head"><div><h2>${t("Wann ist am meisten los?")}</h2><p>${t("Ø Spieler nach Wochentag und Uhrzeit (deutsche Zeit)")}</p></div></div>
          ${summary ? heatmap(summary.heat) : `<div class="loader">…</div>`}
        </section>
        <div>
          <section class="panel-box">
            <div class="panel-box__head"><div><h2>${t("Feste Neustarts")}</h2><p>${t("Täglich, deutsche Zeit – kurz vorher wird im Spiel gewarnt.")}</p></div></div>
            ${rs ? `<div class="restart-list">${rs.times.map((x) => `<span class="${x === rs.next ? "is-next" : ""}">${esc(x.s)}</span>`).join("")}</div>` : `<p class="muted">${t("Keine festen Neustarts")}</p>`}
          </section>
          ${CONFIG.showPlayerList && names.length ? `
          <section class="panel-box">
            <div class="panel-box__head"><div><h2>${t("Gerade online")}</h2></div></div>
            <div class="player-chips">${names.map((n) => `<span>${esc(n)}</span>`).join("")}</div>
          </section>` : ""}
          <a class="btn btn--primary" href="#verbinden" data-tab-link="verbinden">${icon("play")} ${t("Jetzt verbinden")}</a>
        </div>
      </div>`;
    bindChart(series);
  }

  view.addEventListener("click", (e) => {
    const b = e.target.closest("[data-range]");
    if (!b) return;
    range = Number(b.dataset.range);
    render();
  });

  let started = false;
  async function open() {
    render();
    if (!started) { started = true; await loadSummary(); render(); }
  }
  document.addEventListener("tabchange", (e) => { if (e.detail === "status") open(); });
  document.addEventListener("langchange", () => { if (!$("#status").hidden) render(); });
  if (!$("#status").hidden) open();
  // Countdown bis zum Neustart minütlich aktualisieren
  setInterval(() => { if (!$("#status").hidden) render(); }, 60_000);
})();
