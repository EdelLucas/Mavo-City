/* ==========================================================
   Mavo City – Symbole
   icon("shield")        -> SVG aus assets/icons.svg
   iconOrText("shield")  -> Symbol, oder Text/Emoji, falls kein Symbolname
   ========================================================== */
(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  window.icon = (name, cls = "") =>
    `<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="assets/icons.svg#${esc(name)}"></use></svg>`;
  window.iconOrText = (value, fallback = "file") => {
    const v = String(value ?? "").trim();
    if (!v) return icon(fallback);
    return /^[a-z][a-z-]*$/.test(v) ? icon(v) : `<span class="emoji">${esc(v)}</span>`;
  };
})();
