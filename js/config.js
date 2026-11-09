/* ==========================================================
   Mavo City – zentrale Konfiguration
   Hier alles anpassen, was sich ändern kann (Links, IP, Keys).
   ========================================================== */
const CONFIG = {
  serverName: "Mavo City",
  siteUrl: "https://mavocity.com",

  // FiveM Join-Code (aus cfx.re/join/XXXXXX) – nur den Code eintragen
  cfxCode: "abc123",

  // Direkte Verbindung (F8-Konsole: connect <adresse>)
  connectAddress: "play.mavocity.com:30120",

  maxPlayers: 64,

  // Live-Status + Spielerliste über die öffentliche FiveM-API laden (benötigt cfxCode)
  liveStatus: true,
  showPlayerList: true,

  /* ---------- Discord ---------- */
  discordUrl: "https://discord.gg/DEIN-INVITE",
  // Server-ID für das Live-Widget (Discord: Servereinstellungen → Widget → "Server-Widget aktivieren").
  discordServerId: "",

  /* ---------- Supabase (Forum, Admin-Bereich, Umfragen, Quiz) ----------
     Leer lassen = Demo-Modus (alles nur lokal im Browser).
     Einrichtung: siehe ANLEITUNG.md                                     */
  supabaseUrl: "https://gfgbrahibtktjcknhtig.supabase.co",
  supabaseAnonKey: "sb_publishable_K2CyQdVx6I6qZJHSnf24lQ_i8yZX1XI", // Publishable key (darf öffentlich sein – NIEMALS den Secret key!)

  // Twitch-Live-Erkennung über die Supabase-Funktion "twitch-live" (siehe ANLEITUNG.md)
  twitchLiveCheck: false,

  /* ---------- Spenden (Tebex) ---------- */
  tebexUrl: "",          // z.B. "https://mavocity.tebex.io" – leer = "Shop bald verfügbar"

  /* ---------- Regel-Quiz ---------- */
  quizPassPercent: 80,   // so viel Prozent richtige Antworten zum Bestehen

  /* ---------- Startseite: Hintergrund-Video (optional) ----------
     Kurzes, stummes Video (mp4, am besten < 8 MB) in assets/ legen, z.B. "assets/hero.mp4".
     Leer = Bilder aus dem Admin-Bereich bzw. HERO_IMAGES in js/data.js.             */
  heroVideo: "",
  heroVideoPoster: "",   // Standbild, das angezeigt wird, bis das Video lädt (z.B. "assets/hero.jpg")

  /* ---------- Sprache ---------- */
  defaultLanguage: "de", // "de" oder "en"

  /* ---------- Stadtkarte ----------
     Leer = gezeichnete Übersichtskarte. Eigenes Bild (z.B. assets/map.jpg) eintragen,
     dann passen die Marker-Positionen (in %) in js/data.js → MAP_LOCATIONS.        */
  mapImage: "",

  /* ---------- Social Media (leer = ausblenden) ---------- */
  tiktokUrl: "",
  youtubeUrl: "",
  instagramUrl: "",
};
