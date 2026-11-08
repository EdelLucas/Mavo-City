/* ==========================================================
   Mavo City – Inhalte
   Alles hier kann bearbeitet werden, ohne das HTML anzufassen.
   ========================================================== */

/* ---------- News (Start-Tab) ---------- */
const NEWS = [
  { date: "08.11.2026", title: "Neue Website ist online", text: "Forum, Fraktionen, Galerie, Updates und eine Schritt-für-Schritt-Anleitung zum Verbinden – alles an einem Ort." },
  { date: "01.11.2026", title: "Whitelist geöffnet", text: "Ab sofort könnt ihr eure Anträge im Discord einreichen." },
];

/* ---------- Team ---------- */
const TEAM = [
  { name: "Lucas", role: "Projektleitung" },
  { name: "Max", role: "Administration" },
  { name: "Lena", role: "Moderation" },
  { name: "Tim", role: "Entwicklung" },
];

/* ---------- Fraktionen ----------
   type:   "staat" | "crime" | "zivil"
   status: "offen" | "geschlossen"                                   */
const FACTIONS = [
  {
    name: "Los Santos Police Department", short: "LSPD", type: "staat", icon: "🚓", status: "offen",
    desc: "Recht und Ordnung in der Stadt. Streife, Ermittlungen, SWAT und Ausbildung neuer Kadetten.",
    requirements: ["Mindestens 18 Jahre", "Sauberes Führungszeugnis im RP", "Gutes Mikrofon & Funkdisziplin"],
  },
  {
    name: "Rettungsdienst", short: "EMS", type: "staat", icon: "🚑", status: "offen",
    desc: "Notfallversorgung, Krankenhausbetrieb und Bergung – rund um die Uhr im Einsatz.",
    requirements: ["Mindestens 18 Jahre", "Interesse an medizinischem RP", "Teamfähigkeit"],
  },
  {
    name: "Justiz", short: "DOJ", type: "staat", icon: "⚖️", status: "geschlossen",
    desc: "Richter, Staatsanwälte und Verteidiger sorgen für faire Verfahren.",
    requirements: ["Erfahrung im RP", "Sicheres Ausdrucksvermögen"],
  },
  {
    name: "Mechaniker-Werkstatt", short: "Werkstatt", type: "zivil", icon: "🔧", status: "offen",
    desc: "Reparaturen, Tuning und Abschleppdienst für alle Bürger der Stadt.",
    requirements: ["Zuverlässigkeit", "Spaß an Fahrzeugen"],
  },
  {
    name: "Gangs & Organisationen", short: "Crime", type: "crime", icon: "🕶️", status: "offen",
    desc: "Gründet eure eigene Gruppierung. Gebiete, Ruf und Konsequenzen inklusive.",
    requirements: ["Mindestens 4 aktive Mitglieder", "Ausgearbeitetes Konzept", "Regelkenntnis §3"],
  },
];

/* ---------- Galerie ----------
   Bilder in den Ordner assets/gallery/ legen und hier eintragen:
     { type: "image", src: "assets/gallery/bild1.jpg", title: "Titel" }
   YouTube-Videos (nur die ID aus der URL, z.B. youtube.com/watch?v=DIESE_ID):
     { type: "video", youtubeId: "dQw4w9WgXcQ", title: "Titel" }
   Einträge ohne src/youtubeId werden als Platzhalter angezeigt.       */
const GALLERY = [
  { type: "image", src: "", title: "Stadtansicht bei Nacht" },
  { type: "image", src: "", title: "LSPD Einsatz" },
  { type: "image", src: "", title: "Autotreffen am Hafen" },
  { type: "image", src: "", title: "Rettungsdienst im Einsatz" },
  { type: "video", youtubeId: "", title: "Server-Trailer" },
  { type: "image", src: "", title: "Werkstatt" },
];

/* ---------- Updates / Changelog ----------
   type: "neu" | "fix" | "änderung"                                   */
const CHANGELOG = [
  {
    version: "1.1.0", date: "08.11.2026", title: "Website-Update",
    items: [
      { type: "neu", text: "Forum mit Discord-Login" },
      { type: "neu", text: "Fraktions-Übersicht, Galerie und Spenden-Seite" },
      { type: "neu", text: "Live-Anzeige für Discord und Server-Status" },
    ],
  },
  {
    version: "1.0.0", date: "01.11.2026", title: "Server-Start",
    items: [
      { type: "neu", text: "Whitelist geöffnet" },
      { type: "neu", text: "Grundlegende Fraktionen: LSPD, EMS, Werkstatt" },
      { type: "fix", text: "Diverse Startprobleme behoben" },
    ],
  },
];

/* ---------- Spenden-Pakete (nur kosmetisch – kein Pay2Win!) ---------- */
const DONATION_PACKAGES = [
  { name: "Supporter", price: "4,99 €", icon: "💛", perks: ["Discord-Rolle „Supporter“", "Namensfarbe im Forum", "Unser ewiger Dank"] },
  { name: "Unterstützer+", price: "9,99 €", icon: "🧡", highlight: true, perks: ["Alles aus Supporter", "Eigenes Kennzeichen (Wunschtext)", "1 kosmetisches Outfit-Set"] },
  { name: "Partner", price: "19,99 €", icon: "❤️", perks: ["Alles aus Unterstützer+", "Erwähnung im Credits-Kanal", "Vorschlagsrecht für ein Event"] },
];

/* ---------- Forum-Kategorien ---------- */
const FORUM_CATEGORIES = [
  { id: "news",        icon: "📢", title: "Ankündigungen", desc: "Offizielle Neuigkeiten vom Team." },
  { id: "allgemein",   icon: "💬", title: "Allgemein",      desc: "Alles rund um Mavo City." },
  { id: "support",     icon: "🛠️", title: "Support & Bugs", desc: "Probleme melden und Hilfe bekommen." },
  { id: "vorschlaege", icon: "💡", title: "Vorschläge",      desc: "Ideen für Server und Community." },
  { id: "bewerbungen", icon: "📝", title: "Bewerbungen",     desc: "Bewirb dich für Team oder Fraktionen." },
  { id: "fraktionen",  icon: "🚓", title: "Fraktionen",      desc: "Vorstellungen und Infos der Fraktionen." },
];

// Start-Beiträge für den Demo-Modus (ohne Supabase)
const FORUM_SEED = [
  {
    id: "seed-1", cat: "news", pinned: true, title: "Willkommen im Mavo City Forum!",
    posts: [{ id: "p1", author: "Lucas", date: "2026-11-08T12:00:00", text: "Schön, dass du da bist! Bitte lies dir vor dem ersten Beitrag das Regelwerk durch.\n\nViel Spaß in der Stadt!" }],
  },
  {
    id: "seed-2", cat: "bewerbungen", pinned: true, title: "Vorlage: Team-Bewerbung",
    posts: [{ id: "p2", author: "Lucas", date: "2026-11-08T12:05:00", text: "Bitte nutzt folgende Vorlage:\n\n• Name / Alter:\n• Discord-Name:\n• Erfahrung im RP:\n• Warum möchtest du ins Team?\n• Wie viel Zeit kannst du investieren?" }],
  },
];
