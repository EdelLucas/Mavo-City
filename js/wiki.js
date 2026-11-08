/* ==========================================================
   Mavo City – Wiki & Guides
   Routen: #wiki  oder  #wiki/<artikel-id>
   ========================================================== */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const esc = window.escapeHtml;
  let query = "";

  const currentId = () => {
    const [tab, id] = location.hash.slice(1).split("/");
    return tab === "wiki" ? decodeURIComponent(id || "") : "";
  };

  function renderList() {
    const q = query.toLowerCase();
    const items = CONTENT.wiki.filter((a) =>
      !q || a.title.toLowerCase().includes(q) || (a.content || "").toLowerCase().includes(q));
    const active = currentId() || CONTENT.wiki[0]?.id;

    // Nach Kategorie gruppieren
    const groups = {};
    items.forEach((a) => (groups[a.category || t("Allgemein")] ||= []).push(a));

    $("#wikiList").innerHTML = Object.entries(groups).map(([cat, list]) => `
      <div class="wiki__group">
        <span class="wiki__cat">${esc(cat)}</span>
        ${list.map((a) => `
          <a class="wiki__link ${a.id === active ? "is-active" : ""}" href="#wiki/${encodeURIComponent(a.id)}">
            ${iconOrText(a.icon, "file")}${esc(a.title)}
          </a>`).join("")}
      </div>`).join("") || `<p class="muted">${t("Keine Treffer.")}</p>`;
  }

  function renderArticle() {
    const id = currentId();
    const article = CONTENT.wiki.find((a) => a.id === id) || CONTENT.wiki[0];
    $("#wikiArticle").innerHTML = article
      ? renderMarkdown(article.content || "")
      : `<div class="empty">${t("Noch keine Artikel vorhanden.")}</div>`;
  }

  function render() {
    renderList();
    renderArticle();
  }

  $("#wikiSearch").addEventListener("input", (e) => { query = e.target.value; renderList(); });
  window.addEventListener("hashchange", () => {
    if (location.hash.startsWith("#wiki")) {
      render();
      if (currentId() && innerWidth < 860) $("#wikiArticle").scrollIntoView({ behavior: "smooth" });
    }
  });
  document.addEventListener("langchange", () => {
    $("#wikiSearch").placeholder = t("Wiki durchsuchen…");
    render();
  });
  contentReady.then(render);
})();
