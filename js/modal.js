/* ==========================================================
   Mavo City – Dialog (Modal)
   Modal.open(html, { onOpen(box) })  ·  Modal.close()
   ========================================================== */
(() => {
  const modal = document.getElementById("modal");
  const body = document.getElementById("modalBody");
  let lastFocus = null;

  window.Modal = {
    open(html, { onOpen } = {}) {
      lastFocus = document.activeElement;
      body.innerHTML = html;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      onOpen?.(body);
      (body.querySelector("[autofocus], input, textarea, select, button") || body).focus?.();
    },
    close() {
      if (modal.hidden) return;
      modal.hidden = true;
      body.innerHTML = "";
      document.body.style.overflow = "";
      lastFocus?.focus?.();
    },
    get isOpen() { return !modal.hidden; },
  };

  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-modal-close]")) Modal.close();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) Modal.close(); });
})();
