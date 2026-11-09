/* ==========================================================
   Mavo City – Regelwerk: Suche, direkte Links, "Stand"
   Links auf einen Paragraphen:  #regeln/2  (öffnet §2)
   ========================================================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const list = $("#rulesList");
  const input = $("#rulesSearch");
  const empty = $("#rulesEmpty");
  const sections = () => $$("details", list);

  /* ---------- Stand ---------- */
  function renderUpdated() {
    $("#rulesUpdated").innerHTML = CONFIG.rulesUpdated ? `${icon("clock")} ${t("Stand")}: ${window.escapeHtml(CONFIG.rulesUpdated)}` : "";
    input.placeholder = t("Regeln durchsuchen… (z. B. RDM)");
    empty.textContent = t("Keine Regel gefunden.");
  }

  /* ---------- Link-Knopf an jedem Paragraphen ---------- */
  function addLinkButtons() {
    sections().forEach((d) => {
      const s = $("summary", d);
      if ($(".rule-link", s)) return;
      s.insertAdjacentHTML("beforeend", `<button type="button" class="rule-link" data-rule-link="${d.id.replace("regel-", "")}" aria-label="${t("Link zu dieser Regel kopieren")}" title="${t("Link zu dieser Regel kopieren")}">${icon("link")}</button>`);
    });
  }

  list.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-rule-link]");
    if (!b) return;
    e.preventDefault(); // nicht auf-/zuklappen
    const url = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}#regeln/${b.dataset.ruleLink}`;
    try { await navigator.clipboard.writeText(url); showToast(t("Link kopiert!")); } catch { prompt(t("Link kopieren:"), url); }
  });

  /* ---------- Suche mit Hervorhebung ---------- */
  const originals = new Map();
  function clearMarks() {
    originals.forEach((html, el) => { el.innerHTML = html; });
    originals.clear();
  }
  function mark(el, q) {
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    originals.set(el, el.innerHTML);
    // nur Textknoten markieren, HTML bleibt erhalten
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      if (!re.test(n.nodeValue)) return;
      re.lastIndex = 0;
      const span = document.createElement("span");
      span.innerHTML = window.escapeHtml(n.nodeValue).replace(re, "<mark>$1</mark>");
      n.replaceWith(...span.childNodes);
    });
  }

  function search() {
    const q = input.value.trim();
    clearMarks();
    let hits = 0;
    sections().forEach((d) => {
      d.classList.remove("is-hidden");
      $$("li", d).forEach((li) => li.classList.remove("is-hidden"));
      if (!q) return;
      const title = $("summary", d).textContent.toLowerCase().includes(q.toLowerCase());
      const items = $$("li", d);
      const matching = items.filter((li) => li.textContent.toLowerCase().includes(q.toLowerCase()));
      if (!title && !matching.length) { d.classList.add("is-hidden"); return; }
      hits++;
      d.open = true;
      if (!title) items.forEach((li) => li.classList.toggle("is-hidden", !matching.includes(li)));
      matching.forEach((li) => mark(li, q));
    });
    empty.hidden = !q || hits > 0;
  }
  input.addEventListener("input", search);
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.value = ""; search(); } });

  /* ---------- #regeln/2 öffnet §2 ---------- */
  function openFromHash() {
    const [tab, n] = decodeURIComponent(location.hash.slice(1)).split("/");
    if (tab !== "regeln" || !n) return;
    const d = $(`#regel-${CSS.escape(n)}`);
    if (!d) return;
    sections().forEach((x) => x.classList.toggle("is-target", x === d));
    d.open = true;
    requestAnimationFrame(() => d.scrollIntoView({ behavior: "smooth", block: "center" }));
  }
  window.addEventListener("hashchange", openFromHash);
  document.addEventListener("tabchange", (e) => { if (e.detail === "regeln") setTimeout(openFromHash, 50); });

  function init() { clearMarks(); renderUpdated(); addLinkButtons(); if (input.value) search(); }
  document.addEventListener("langchange", init);
  // Nach js/i18n.js (das die Texte beim Laden einmal setzt)
  document.addEventListener("DOMContentLoaded", () => { init(); openFromHash(); });
})();
