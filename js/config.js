/* ==========================================================
   Mavo City – zentrale Konfiguration
   Hier alles anpassen, was sich ändern kann (Links, IP, Texte).
   ========================================================== */
const CONFIG = {
  serverName: "Mavo City",

  // FiveM Join-Code (aus cfx.re/join/XXXXXX) – nur den Code eintragen
  cfxCode: "abc123",

  // Direkte Verbindung (F8-Konsole: connect <adresse>)
  connectAddress: "play.mavocity.com:30120",

  discordUrl: "https://discord.gg/DEIN-INVITE",
  tiktokUrl: "",
  youtubeUrl: "",

  maxPlayers: 64,

  // Live-Status über die öffentliche FiveM-API laden (benötigt cfxCode).
  // Falls die API nicht erreichbar ist, wird "Status unbekannt" angezeigt.
  liveStatus: true,
};
