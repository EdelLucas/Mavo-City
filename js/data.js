/* ==========================================================
   Mavo City – Inhalte (News, Team, Forum-Kategorien)
   Einfach hier bearbeiten, ohne das HTML anzufassen.
   ========================================================== */
const NEWS = [
  { date: "08.11.2026", title: "Neue Website ist online", text: "Forum, Regelwerk und eine Schritt-für-Schritt-Anleitung zum Verbinden – alles an einem Ort." },
  { date: "01.11.2026", title: "Whitelist geöffnet", text: "Ab sofort könnt ihr eure Anträge im Discord einreichen." },
];

const TEAM = [
  { name: "Lucas", role: "Projektleitung" },
  { name: "Max", role: "Administration" },
  { name: "Lena", role: "Moderation" },
  { name: "Tim", role: "Entwicklung" },
];

const FORUM_CATEGORIES = [
  { id: "news",       icon: "📢", title: "Ankündigungen",   desc: "Offizielle Neuigkeiten vom Team." },
  { id: "allgemein",  icon: "💬", title: "Allgemein",        desc: "Alles rund um Mavo City." },
  { id: "support",    icon: "🛠️", title: "Support & Bugs",   desc: "Probleme melden und Hilfe bekommen." },
  { id: "vorschlaege",icon: "💡", title: "Vorschläge",        desc: "Ideen für Server und Community." },
  { id: "bewerbungen",icon: "📝", title: "Bewerbungen",       desc: "Bewirb dich für Team oder Fraktionen." },
  { id: "fraktionen", icon: "🚓", title: "Fraktionen",        desc: "Vorstellungen und Infos der Fraktionen." },
];

// Start-Beiträge, damit das Forum beim ersten Besuch nicht leer ist
const FORUM_SEED = [
  {
    id: "seed-1", cat: "news", pinned: true, title: "Willkommen im Mavo City Forum!",
    posts: [{ author: "Lucas", date: "2026-11-08T12:00:00", text: "Schön, dass du da bist! Bitte lies dir vor dem ersten Beitrag das Regelwerk durch.\n\nViel Spaß in der Stadt!" }],
  },
  {
    id: "seed-2", cat: "bewerbungen", pinned: true, title: "Vorlage: Team-Bewerbung",
    posts: [{ author: "Lucas", date: "2026-11-08T12:05:00", text: "Bitte nutzt folgende Vorlage:\n\n• Name / Alter:\n• Discord-Name:\n• Erfahrung im RP:\n• Warum möchtest du ins Team?\n• Wie viel Zeit kannst du investieren?" }],
  },
];
