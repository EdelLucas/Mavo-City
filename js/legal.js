/* ==========================================================
   Mavo City – kleine Helfer für Impressum & Datenschutz
   ========================================================== */
document.querySelectorAll(".js-discord").forEach((a) => (a.href = CONFIG.discordUrl));
document.getElementById("year").textContent = new Date().getFullYear();
