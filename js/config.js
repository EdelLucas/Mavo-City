/* ==========================================================
   Mavo City – zentrale Konfiguration
   Hier alles anpassen, was sich ändern kann (Links, IP, Keys).
   ========================================================== */
const CONFIG = {
  serverName: "Mavo City",

  // FiveM Join-Code (aus cfx.re/join/XXXXXX) – nur den Code eintragen
  cfxCode: "abc123",

  // Direkte Verbindung (F8-Konsole: connect <adresse>)
  connectAddress: "play.mavocity.com:30120",

  maxPlayers: 64,

  // Live-Status über die öffentliche FiveM-API laden (benötigt cfxCode)
  liveStatus: true,

  /* ---------- Discord ---------- */
  discordUrl: "https://discord.gg/DEIN-INVITE",
  // Server-ID für das Live-Widget (Discord: Servereinstellungen → Widget → "Server-Widget aktivieren").
  // Leer lassen = Widget zeigt nur den Beitreten-Button.
  discordServerId: "",

  /* ---------- Forum (Supabase) ----------
     Leer lassen = Forum läuft im Demo-Modus (nur lokal im Browser).
     Einrichtung: siehe ANLEITUNG.md                                   */
  supabaseUrl: "",       // z.B. "https://abcdefgh.supabase.co"
  supabaseAnonKey: "",   // "anon public" Key (darf öffentlich sein)

  /* ---------- Spenden (Tebex) ---------- */
  tebexUrl: "",          // z.B. "https://mavocity.tebex.io" – leer = "Shop bald verfügbar"

  /* ---------- Social Media (leer = ausblenden) ---------- */
  tiktokUrl: "",
  youtubeUrl: "",
  instagramUrl: "",
};
