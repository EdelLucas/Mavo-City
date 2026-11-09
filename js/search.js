/* ==========================================================
   Mavo City – Suche über die ganze Seite (Strg+K oder "/")
   Durchsucht: Seiten, Regeln, FAQ, Wiki, Fraktionen, Events,
   News und (mit Supabase) Forenthemen.
   ========================================================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = window.escapeHtml;
  const dlg = $("#searchDialog");
  const input = $("#searchInput");
  const out = $("#searchResults");
  let active = 0;
  let hits = [];
  let forumTimer = null;
  let seq = 0;

  const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const text = (html) => { const d = document.createElement("div"); d.innerHTML = html; return d.textContent.replace(/\s+/g, " ").trim(); };

  function snippet(str, q) {
    const s = String(str || "");
    const i = norm(s).indexOf(norm(q));
    const from = Math.max(0, i - 40);
    const part = (from ? "…" : "") + s.slice(from, from + 120) + (s.length > from + 120 ? "…" : "");
    return esc(part).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
  }

  /* ---------- Index ---------- */
  function buildIndex() {
    const idx = [];
    // Seiten aus der Navigation
    $$(".tab[data-tab]").forEach((b) => {
      if (b.hidden) return;
      const panel = $(`#${b.dataset.tab}`);
      idx.push({ group: t("Seiten"), icon: $("use", b)?.getAttribute("href").split("#")[1] || "file",
        title: b.textContent.trim(), body: $(".page-lead", panel)?.textContent || "", hash: `#${b.dataset.tab}` });
    });
    // Regeln (einzelne Punkte)
    $$("#rulesList details").forEach((d) => {
      const head = $("summary", d).textContent.trim();
      const n = d.id.replace("regel-", "");
      idx.push({ group: t("Regelwerk"), icon: "scale", title: head, body: $$("li", d).map((li) => li.textContent).join(" · "), hash: `#regeln/${n}` });
    });
    // FAQ
    $$("#faq details").forEach((d) => {
      idx.push({ group: "FAQ", icon: "info", title: $("summary", d).textContent.trim(), body: text($("p", d)?.innerHTML || ""), hash: "#faq", open: d });
    });
    // Wiki
    (CONTENT.wiki || []).forEach((w) => idx.push({ group: "Wiki", icon: w.icon || "book", title: w.title, body: String(w.content || "").replace(/[#*|>`-]/g, " "), hash: `#wiki/${w.id}` }));
    // Fraktionen
    (CONTENT.factions || []).forEach((f) => idx.push({ group: t("Fraktionen"), icon: f.icon || "shield", title: f.name, body: `${f.short || ""} ${f.desc || ""}`, hash: "#fraktionen" }));
    // Events
    (CONTENT.events || []).forEach((e) => idx.push({ group: "Events", icon: "calendar", title: e.title, body: `${e.location || ""} ${e.desc || ""}`, hash: "#events" }));
    // News & Updates
    (CONTENT.news || []).forEach((n) => idx.push({ group: t("Neuigkeiten"), icon: "megaphone", title: n.title, body: n.text, hash: "#updates" }));
    return idx;
  }

  function score(item, q) {
    const nt = norm(item.title), nb = norm(item.body), nq = norm(q);
    if (nt.startsWith(nq)) return 3;
    if (nt.includes(nq)) return 2;
    if (nb.includes(nq)) return 1;
    return 0;
  }

  function render() {
    const q = input.value.trim();
    if (!q) {
      // Schnellzugriff
      hits = buildIndex().filter((i) => i.group === t("Seiten"));
    } else {
      hits = buildIndex().map((i) => ({ ...i, s: score(i, q) })).filter((i) => i.s).sort((a, b) => b.s - a.s).slice(0, 30);
    }
    active = 0;
    draw(q);
    if (q.length >= 3) searchForum(q); else clearTimeout(forumTimer);
  }

  function draw(q, forum = []) {
    const all = [...hits, ...forum];
    hits = all;
    if (!all.length) { out.innerHTML = `<div class="search-empty">${t("Keine Treffer für „{q}“.", { q: esc(q) })}</div>`; return; }
    let last = "";
    out.innerHTML = all.map((h, i) => {
      const head = h.group !== last ? `<div class="search-group">${esc(h.group)}</div>` : "";
      last = h.group;
      return `${head}<button class="search-hit ${i === active ? "is-active" : ""}" role="option" data-hit="${i}">
        ${icon(h.icon)}<span>${q ? snippet(h.title, q) : esc(h.title)}${h.body ? `<small>${q ? snippet(h.body, q) : esc(h.body.slice(0, 90))}</small>` : ""}</span></button>`;
    }).join("");
  }

  function searchForum(q) {
    clearTimeout(forumTimer);
    const my = ++seq;
    forumTimer = setTimeout(async () => {
      const sb = await getSupabase();
      if (!sb || my !== seq) return;
      const like = `%${q.replace(/[%_]/g, "")}%`;
      const { data } = await sb.from("forum_threads").select("id, title, category").ilike("title", like).order("last_post_at", { ascending: false }).limit(8);
      if (my !== seq || !data?.length) return;
      const base = hits.filter((h) => h.group !== "Forum");
      hits = base;
      draw(q, data.map((th) => ({ group: "Forum", icon: "chat", title: th.title, body: "", hash: `#forum/thread/${th.id}` })));
    }, 250);
  }

  function go(i) {
    const h = hits[i];
    if (!h) return;
    close();
    if (h.open) h.open.open = true;
    const tab = h.hash.slice(1).split("/")[0];
    if (location.hash === h.hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
    else location.hash = h.hash;
    window.openTab?.(tab, { updateHash: false });
    if (h.open) setTimeout(() => h.open.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }

  function open() {
    dlg.hidden = false;
    document.body.style.overflow = "hidden";
    input.value = "";
    render();
    input.focus();
  }
  function close() {
    if (dlg.hidden) return;
    dlg.hidden = true;
    document.body.style.overflow = "";
  }

  $("#searchBtn").addEventListener("click", open);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  input.addEventListener("input", render);
  out.addEventListener("click", (e) => { const b = e.target.closest("[data-hit]"); if (b) go(Number(b.dataset.hit)); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % Math.max(1, hits.length);
      $$(".search-hit", out).forEach((b, i) => b.classList.toggle("is-active", i === active));
      $(".search-hit.is-active", out)?.scrollIntoView({ block: "nearest" });
    }
    if (e.key === "Enter") { e.preventDefault(); go(active); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return close();
    const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
      e.preventDefault();
      dlg.hidden ? open() : close();
    }
  });
  document.addEventListener("langchange", () => { input.placeholder = t("Seiten, Regeln, Wiki, Forum durchsuchen…"); });
})();
