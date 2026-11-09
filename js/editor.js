/* ==========================================================
   Mavo City – Werkzeugleiste für formatierten Text
   Verwendung:  <div class="md-editor">${mdToolbar()}<textarea>…</textarea></div>
   Die Knöpfe fügen die Formatierung an der markierten Stelle ein –
   praktisch auf Tablet und Handy.
   ========================================================== */
(() => {
  const TOOLS = [
    ["bold", "B", "Fett", "**", "**", "fett"],
    ["italic", "I", "Kursiv", "*", "*", "kursiv"],
    ["heading", "H", "Überschrift", "\n## ", "\n", "Überschrift"],
    ["quote", "❝", "Zitat", "\n> ", "\n", "Zitat"],
    ["list", "•", "Liste", "\n- ", "", "Punkt"],
    ["link", "🔗", "Link", "[", "](https://)", "Linktext"],
    ["image", "🖼", "Bild", "![", "](https://)", "Bild"],
    ["code", "</>", "Code", "`", "`", "code"],
  ];

  window.mdToolbar = () => `
    <div class="md-toolbar" role="toolbar" aria-label="${t("Formatierung")}">
      ${TOOLS.map(([id, label, title]) => `<button type="button" class="md-toolbar__btn md-toolbar__btn--${id}" data-md="${id}" title="${t(title)}" aria-label="${t(title)}">${label}</button>`).join("")}
    </div>`;

  window.insertIntoTextarea = (ta, before, after = "", placeholder = "") => {
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const selected = ta.value.slice(start, end) || placeholder;
    // Zeilenanfang-Formatierungen: kein Leerzeilen-Präfix am Textanfang
    const pre = start === 0 ? before.replace(/^\n/, "") : before;
    ta.setRangeText(pre + selected + after, start, end, "end");
    // Platzhalter markieren, damit man direkt drüber tippen kann
    if (!ta.value.slice(start, end).length || selected === placeholder) {
      const s = start + pre.length;
      ta.setSelectionRange(s, s + selected.length);
    }
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  };

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-md]");
    if (!btn) return;
    e.preventDefault();
    const box = btn.closest(".md-editor");
    const ta = box?.querySelector("textarea");
    if (!ta) return;
    const tool = TOOLS.find((x) => x[0] === btn.dataset.md);
    insertIntoTextarea(ta, tool[3], tool[4], t(tool[5]));
  });

  // Strg/Cmd + B / I
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || !e.target.closest?.(".md-editor textarea")) return;
    const map = { b: "bold", i: "italic", k: "link" };
    const id = map[e.key.toLowerCase()];
    if (!id) return;
    e.preventDefault();
    const tool = TOOLS.find((x) => x[0] === id);
    insertIntoTextarea(e.target, tool[3], tool[4], t(tool[5]));
  });
})();
