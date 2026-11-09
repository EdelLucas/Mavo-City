/* ==========================================================
   Mavo City – Inhaltsseiten: News, Team, Fraktionen, Galerie,
   Updates, Spenden. Daten: window.CONTENT (js/content.js)
   ========================================================== */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const esc = window.escapeHtml;

  /* ---------- Datum "08.11.2026" oder "2026-11-08" -> Date ---------- */
  window.parseDeDate = (s) => {
    const str = String(s || "").trim();
    let m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return null;
  };

  /* ---------- News (neueste zuerst, auf der Startseite die 3 neuesten) ---------- */
  function renderNews() {
    const list = CONTENT.news
      .map((n, i) => ({ ...n, i, at: parseDeDate(n.date) }))
      .sort((a, b) => (b.at || 0) - (a.at || 0) || a.i - b.i)
      .slice(0, 3);
    const fresh = (d) => d && Date.now() - d.getTime() < 7 * 86400_000;
    $("#newsList").innerHTML = list.map((n) => `
      <article class="news__item card">
        <div class="news__top">
          <span class="news__date">${icon("calendar")} ${esc(n.date)}</span>
          ${fresh(n.at) ? `<span class="tag tag--accent">${t("Neu")}</span>` : ""}
        </div>
        <h3>${esc(n.title)}</h3><p>${esc(n.text)}</p>
      </article>`).join("") || `<div class="empty">${t("Noch keine Neuigkeiten.")}</div>`;
  }

  /* ---------- Team ----------
     group: leitung | admin | mod | dev | support  (Farbe der Karte)
     discord: Discord-Name – damit wird "online" aus dem Discord-Widget erkannt */
  const GROUPS = { leitung: "Projektleitung", admin: "Administration", mod: "Moderation", dev: "Entwicklung", support: "Support" };
  const guessGroup = (role) => {
    const r = String(role || "").toLowerCase();
    if (/leit|owner|inhaber|founder/.test(r)) return "leitung";
    if (/admin/.test(r)) return "admin";
    if (/mod/.test(r)) return "mod";
    if (/entwick|dev|script/.test(r)) return "dev";
    return "support";
  };
  function onlineNames() {
    const w = window.DISCORD_WIDGET;
    return new Set((w?.members || []).map((m) => String(m.username || "").toLowerCase()));
  }
  function renderTeam() {
    const online = onlineNames();
    $("#teamGrid").innerHTML = CONTENT.team.map((m) => {
      const group = m.group || guessGroup(m.role);
      const isOn = online.has(String(m.discord || m.name || "").toLowerCase());
      return `
      <article class="card member member--${esc(group)}">
        <div class="member__pic">
          ${m.avatar
            ? `<img class="member__avatar" src="${esc(m.avatar)}" alt="" width="84" height="84" loading="lazy">`
            : `<div class="member__avatar">${esc((m.name || "?")[0])}</div>`}
          ${isOn ? `<span class="member__online" title="${t("Gerade im Discord online")}"></span>` : ""}
        </div>
        <h3>${esc(m.name)}</h3>
        <span class="member__role">${esc(m.role || GROUPS[group])}</span>
      </article>`;
    }).join("");
  }
  document.addEventListener("discordwidget", renderTeam);

  /* ---------- Fraktionen ---------- */
  let factionFilter = "alle";
  window.setFactionFilter = (f) => {
    factionFilter = f;
    document.querySelectorAll("#factionFilter .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.filter === f));
    renderFactions();
  };
  function renderFactions() {
    const typeLabel = { staat: t("Staat"), zivil: t("Zivil"), crime: "Crime" };
    const list = CONTENT.factions.map((f, i) => ({ ...f, i })).filter((f) => factionFilter === "alle" || f.type === factionFilter);
    $("#factionGrid").innerHTML = list.map((f) => {
      const open = f.status === "offen";
      return `
        <article class="card faction faction--${esc(f.type)}">
          ${f.image ? `<div class="faction__banner" style="background-image:url('${esc(f.image).replace(/'/g, "%27")}')"></div>` : ""}
          <div class="faction__head">
            <span class="faction__icon">${iconOrText(f.icon, "shield")}</span>
            <div>
              <h3>${esc(f.name)}</h3>
              <span class="tag">${esc(typeLabel[f.type] || f.type)}</span>
              <span class="tag ${open ? "tag--ok" : "tag--no"}">${open ? t("Bewerbung offen") : t("Bewerbung geschlossen")}</span>
            </div>
          </div>
          <p>${esc(f.desc)}</p>
          ${f.members || f.contact ? `
            <div class="faction__facts">
              ${f.members ? `<span>${icon("users")} ${esc(f.members)}</span>` : ""}
              ${f.contact ? `<span>${icon("chat")} ${t("Ansprechpartner")}: <strong>${esc(f.contact)}</strong></span>` : ""}
            </div>` : ""}
          ${f.requirements?.length ? `
            <h4>${t("Voraussetzungen")}</h4>
            <ul class="checklist">${f.requirements.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
          ${open
            ? `<button class="btn btn--primary btn--sm" data-apply="${f.i}">${t("Jetzt bewerben")}</button>`
            : `<button class="btn btn--ghost btn--sm" disabled>${t("Aktuell keine Bewerbungen")}</button>`}
        </article>`;
    }).join("") || `<div class="empty">${t("Keine Fraktionen in dieser Kategorie.")}</div>`;
  }

  $("#factionFilter").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filter]");
    if (!chip) return;
    document.querySelectorAll("#factionFilter .chip").forEach((c) => c.classList.toggle("is-active", c === chip));
    factionFilter = chip.dataset.filter;
    renderFactions();
  });

  /* ---------- Galerie + Lightbox ---------- */
  const ytThumb = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
  const hasMedia = (g) => (g.type === "video" ? !!g.youtubeId : !!g.src);

  function renderGallery() {
    // Solange es keine echten Bilder gibt, den Menüpunkt ausblenden – leere Platzhalter wirken unfertig
    const any = CONTENT.gallery.some(hasMedia);
    document.querySelectorAll('[data-tab="galerie"], [data-tab-link="galerie"]').forEach((el) => (el.hidden = !any));
    if (!any) { $("#galleryGrid").innerHTML = `<div class="empty">${t("Noch keine Bilder.")}</div>`; return; }
    $("#galleryGrid").innerHTML = CONTENT.gallery.map((g, i) => {
      if (!hasMedia(g)) return "";
      const thumb = g.type === "video" ? ytThumb(g.youtubeId) : g.src;
      return `
        <figure class="gallery__item" data-index="${i}" tabindex="0" role="button" aria-label="${esc(g.title)}">
          <img src="${esc(thumb)}" alt="${esc(g.title)}" loading="lazy">
          ${g.type === "video" ? `<span class="gallery__play">${icon("play")}</span>` : ""}
          <figcaption>${esc(g.title)}</figcaption>
        </figure>`;
    }).join("") || `<div class="empty">${t("Noch keine Bilder.")}</div>`;
  }

  const lb = $("#lightbox");
  let current = 0;
  const playable = () => CONTENT.gallery.map((g, i) => (hasMedia(g) ? i : null)).filter((i) => i !== null);

  function showItem(index) {
    current = index;
    const g = CONTENT.gallery[index];
    $("#lightboxMedia").innerHTML = g.type === "video"
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(g.youtubeId)}?autoplay=1" title="${esc(g.title)}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`
      : `<img src="${esc(g.src)}" alt="${esc(g.title)}">`;
    $("#lightboxCaption").textContent = g.title;
    const multi = playable().length > 1;
    lb.querySelectorAll(".lightbox__nav").forEach((b) => (b.hidden = !multi));
  }
  function step(dir) {
    const list = playable();
    const pos = list.indexOf(current);
    showItem(list[(pos + dir + list.length) % list.length]);
  }
  function openLightbox(index) {
    showItem(index);
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    lb.hidden = true;
    $("#lightboxMedia").innerHTML = ""; // stoppt Videos
    document.body.style.overflow = "";
  }

  $("#galleryGrid").addEventListener("click", (e) => {
    const item = e.target.closest("[data-index]");
    if (item) openLightbox(Number(item.dataset.index));
  });
  $("#galleryGrid").addEventListener("keydown", (e) => {
    const item = e.target.closest("[data-index]");
    if (item && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openLightbox(Number(item.dataset.index)); }
  });
  lb.querySelector(".lightbox__close").addEventListener("click", closeLightbox);
  lb.querySelector(".lightbox__nav--prev").addEventListener("click", () => step(-1));
  lb.querySelector(".lightbox__nav--next").addEventListener("click", () => step(1));
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  /* ---------- Updates / Changelog ---------- */
  function renderChangelog() {
    const label = { neu: t("Neu"), fix: "Fix", "änderung": t("Änderung") };
    $("#changelog").innerHTML = CONTENT.changelog.map((v) => `
      <article class="release">
        <div class="release__meta">
          <span class="release__version">v${esc(v.version)}</span>
          <span class="release__date">${esc(v.date)}</span>
        </div>
        <div class="release__body">
          <h3>${esc(v.title)}</h3>
          <ul>${(v.items || []).map((it) => `
            <li><span class="change change--${it.type === "änderung" ? "change" : esc(it.type)}">${esc(label[it.type] || it.type)}</span>${esc(it.text)}</li>`).join("")}
          </ul>
        </div>
      </article>`).join("");
  }

  /* ---------- Spenden-Pakete ---------- */
  function renderPackages() {
    const shop = CONFIG.tebexUrl;
    $("#packageGrid").innerHTML = CONTENT.packages.map((p) => `
      <article class="card package ${p.highlight ? "package--highlight" : ""}">
        ${p.highlight ? `<span class="package__badge">${t("Beliebt")}</span>` : ""}
        <div class="package__icon">${iconOrText(p.icon, "heart")}</div>
        <h3>${esc(p.name)}</h3>
        <div class="package__price">${esc(p.price)}</div>
        <ul class="checklist">${(p.perks || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        ${shop
          ? `<a class="btn ${p.highlight ? "btn--primary" : "btn--ghost"}" href="${esc(shop)}" target="_blank" rel="noopener">${t("Zum Shop")}</a>`
          : `<button class="btn btn--ghost" disabled>${t("Shop bald verfügbar")}</button>`}
      </article>`).join("");
  }

  function renderAll() {
    renderNews(); renderTeam(); renderFactions(); renderGallery(); renderChangelog(); renderPackages();
  }
  contentReady.then(renderAll);
  document.addEventListener("langchange", renderAll);
})();
