/* ==========================================================
   Mavo City – Interaktive Stadtkarte
   Orte: CONTENT.map  (x / y in Prozent)
   Bild: CONFIG.mapImage oder assets/map.svg
   ========================================================== */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const esc = window.escapeHtml;
  const TYPES = {
    staat: { icon: "building", label: "Staat" },
    zivil: { icon: "store", label: "Zivil" },
    job: { icon: "briefcase", label: "Jobs" },
    freizeit: { icon: "sun", label: "Freizeit" },
    crime: { icon: "mask", label: "Crime" },
  };
  let filter = "alle";
  let selected = null;

  function renderFilter() {
    const used = [...new Set(CONTENT.map.map((l) => l.type))];
    $("#mapFilter").innerHTML = [["alle", t("Alle")], ...used.map((ty) => [ty, `${icon(TYPES[ty]?.icon || "pin")} ${esc(t(TYPES[ty]?.label || ty))}`])]
      .map(([key, label]) => `<button class="chip ${filter === key ? "is-active" : ""}" data-map-filter="${esc(key)}">${label}</button>`).join("");
  }

  function renderMap() {
    const img = CONFIG.mapImage || "assets/map.svg";
    $("#mapCanvas").innerHTML = `
      <img src="${esc(img)}" alt="${t("Karte von Mavo City")}" draggable="false">
      ${CONTENT.map.map((l, i) => `
        <button class="pin pin--${esc(l.type)} ${filter !== "alle" && l.type !== filter ? "is-dim" : ""} ${selected === i ? "is-selected" : ""}"
          style="left:${Number(l.x) || 0}%;top:${Number(l.y) || 0}%" data-pin="${i}" aria-label="${esc(l.name)}">
          <span class="pin__icon"><span>${icon(TYPES[l.type]?.icon || "pin")}</span></span>
          <span class="pin__label">${esc(l.name)}</span>
        </button>`).join("")}`;
  }

  function renderInfo() {
    const l = CONTENT.map[selected];
    const visible = CONTENT.map.map((x, i) => ({ ...x, i })).filter((x) => filter === "alle" || x.type === filter);
    $("#mapInfo").innerHTML = l
      ? `<span class="tag">${icon(TYPES[l.type]?.icon || "pin")} ${esc(t(TYPES[l.type]?.label || l.type))}</span>
         <h3>${esc(l.name)}</h3>
         <p>${esc(l.desc || "")}</p>
         <button class="btn btn--ghost btn--sm" data-map-close>${t("Alle Orte")}</button>`
      : `<h3>${t("Orte")}</h3>
         <ul class="map-list">${visible.map((x) => `
           <li><button data-pin="${x.i}">${icon(TYPES[x.type]?.icon || "pin")} ${esc(x.name)}</button></li>`).join("")}</ul>`;
  }

  function render() { renderFilter(); renderMap(); renderInfo(); }

  document.addEventListener("click", (e) => {
    const f = e.target.closest("[data-map-filter]");
    if (f) { filter = f.dataset.mapFilter; selected = null; return render(); }
    const p = e.target.closest("[data-pin]");
    if (p) {
      selected = Number(p.dataset.pin);
      renderMap(); renderInfo();
      if (innerWidth < 860) $("#mapInfo").scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    if (e.target.closest("[data-map-close]")) { selected = null; renderMap(); renderInfo(); }
  });

  contentReady.then(render);
  document.addEventListener("langchange", render);
})();
