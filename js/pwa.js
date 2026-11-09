/* ==========================================================
   Mavo City – App-Installation (PWA)
   Registriert den Service Worker und zeigt einmalig einen
   dezenten Hinweis "Als App installieren" (Android/Chrome/Edge)
   bzw. eine Anleitung für iPhone (Teilen → Zum Home-Bildschirm).
   ========================================================== */
(() => {
  const KEY = "mavo_install_hint";
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  const dismissed = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone || dismissed()) return;

  let deferred = null;
  function show(text, withButton) {
    if (document.querySelector(".install-hint")) return;
    const el = document.createElement("div");
    el.className = "install-hint";
    el.innerHTML = `
      <img src="assets/app/icon-192.png" alt="">
      <div><strong>${t("Mavo City als App")}</strong><small>${text}</small></div>
      ${withButton ? `<button class="btn btn--primary btn--sm" data-install>${t("Installieren")}</button>` : ""}
      <button class="icon-btn" data-close aria-label="${t("Schließen")}">${icon("x")}</button>`;
    document.body.append(el);
    el.addEventListener("click", async (e) => {
      if (e.target.closest("[data-install]") && deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; }
      if (e.target.closest("[data-install], [data-close]")) {
        try { localStorage.setItem(KEY, "1"); } catch { /* egal */ }
        el.remove();
      }
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    // erst nach etwas Zeit auf der Seite zeigen, nicht sofort
    setTimeout(() => show(t("Server-Status, Forum und Events mit einem Tipp öffnen."), true), 25_000);
  });

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if (ios) setTimeout(() => show(t("Tippe auf „Teilen“ und dann „Zum Home-Bildschirm“."), false), 30_000);
})();
