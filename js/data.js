/* ==========================================================
   Mavo City – Inhalte
   Alles hier kann bearbeitet werden, ohne das HTML anzufassen.
   ========================================================== */

/* ---------- News (Start-Tab) ---------- */
const NEWS = [
  { date: "08.11.2026", title: "Neue Website ist online", text: "Forum, Fraktionen, Galerie, Updates und eine Schritt-für-Schritt-Anleitung zum Verbinden – alles an einem Ort." },
  { date: "01.11.2026", title: "Server geöffnet", text: "Mavo City ist online – ohne Whitelist. Regeln lesen, verbinden, losspielen!" },
];

/* ---------- Team ----------
   group:   leitung | admin | mod | dev | support  (Farbe der Karte)
   discord: Discord-Name (optional) – grüner Punkt, wenn online im Discord
   avatar:  Bild-URL (optional)                                       */
const TEAM = [
  { name: "Lucas", role: "Projektleitung", group: "leitung" },
  { name: "Max", role: "Administration", group: "admin" },
  { name: "Lena", role: "Moderation", group: "mod" },
  { name: "Tim", role: "Entwicklung", group: "dev" },
];

/* ---------- Symbole ----------
   Bei "icon" kann ein Symbol-Name aus assets/icons.svg stehen, z.B.:
   shield, medkit, scale, wrench, mask, briefcase, car, building, store, star,
   heart, trophy, flag, keyboard, book, chat, megaphone, lightbulb, file, users,
   calendar, map, pin, gamepad, gift, camera, video, sun, lock, info
   (Ein Emoji funktioniert weiterhin, sieht aber je nach Gerät anders aus.)  */

/* ---------- Fraktionen ----------
   type:    "staat" | "crime" | "zivil"
   status:  "offen" | "geschlossen"
   members: z. B. "14 Mitglieder" (optional)
   contact: Ansprechpartner (optional)
   image:   Titelbild, z. B. "assets/lspd.jpg" (optional)            */
const FACTIONS = [
  {
    name: "Los Santos Police Department", short: "LSPD", type: "staat", icon: "shield", status: "offen",
    desc: "Recht und Ordnung in der Stadt. Streife, Ermittlungen, SWAT und Ausbildung neuer Kadetten.",
    members: "", contact: "",
    requirements: ["Mindestens 18 Jahre", "Sauberes Führungszeugnis im RP", "Gutes Mikrofon & Funkdisziplin"],
  },
  {
    name: "Rettungsdienst", short: "EMS", type: "staat", icon: "medkit", status: "offen",
    desc: "Notfallversorgung, Krankenhausbetrieb und Bergung – rund um die Uhr im Einsatz.",
    requirements: ["Mindestens 18 Jahre", "Interesse an medizinischem RP", "Teamfähigkeit"],
  },
  {
    name: "Justiz", short: "DOJ", type: "staat", icon: "scale", status: "geschlossen",
    desc: "Richter, Staatsanwälte und Verteidiger sorgen für faire Verfahren.",
    requirements: ["Erfahrung im RP", "Sicheres Ausdrucksvermögen"],
  },
  {
    name: "Mechaniker-Werkstatt", short: "Werkstatt", type: "zivil", icon: "wrench", status: "offen",
    desc: "Reparaturen, Tuning und Abschleppdienst für alle Bürger der Stadt.",
    requirements: ["Zuverlässigkeit", "Spaß an Fahrzeugen"],
  },
  {
    name: "Gangs & Organisationen", short: "Crime", type: "crime", icon: "mask", status: "offen",
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
      { type: "neu", text: "Server geöffnet (ohne Whitelist)" },
      { type: "neu", text: "Grundlegende Fraktionen: LSPD, EMS, Werkstatt" },
      { type: "fix", text: "Diverse Startprobleme behoben" },
    ],
  },
];

/* ---------- Spenden-Pakete (nur kosmetisch – kein Pay2Win!) ---------- */
const DONATION_PACKAGES = [
  { name: "Supporter", price: "4,99 €", icon: "heart", perks: ["Discord-Rolle „Supporter“", "Namensfarbe im Forum", "Unser ewiger Dank"] },
  { name: "Unterstützer+", price: "9,99 €", icon: "star", highlight: true, perks: ["Alles aus Supporter", "Eigenes Kennzeichen (Wunschtext)", "1 kosmetisches Outfit-Set"] },
  { name: "Partner", price: "19,99 €", icon: "trophy", perks: ["Alles aus Unterstützer+", "Erwähnung im Credits-Kanal", "Vorschlagsrecht für ein Event"] },
];

/* ---------- Forum-Kategorien ----------
   id: nur a-z, 0-9 und "-" (nach dem Anlegen nicht mehr ändern!)
   group:     Bereich, in dem das Forum angezeigt wird (gleicher Text = gleicher Bereich)
   adminOnly: true = nur Admins dürfen dort Themen erstellen
   statuses:  true = Themen haben einen Status (Offen, In Bearbeitung, Angenommen, …)
   template:  Vorlage, die beim Erstellen eines Themas schon im Textfeld steht
   Im Admin-Bereich unter „Forum-Kategorien“ bearbeitbar.                     */
const FORUM_CATEGORIES = [
  /* ===== Wichtige Informationen ===== */
  { id: "news", group: "Wichtige Informationen", icon: "megaphone", title: "Ankündigungen",
    desc: "Offizielle Neuigkeiten, Wartungen und Events vom Team.", adminOnly: true },
  { id: "regeln", group: "Wichtige Informationen", icon: "scale", title: "Regelwerk & Änderungen",
    desc: "Aktuelle Regeln, Strafkatalog und Regeländerungen.", adminOnly: true },
  { id: "guides", group: "Wichtige Informationen", icon: "book", title: "Guides & Tutorials",
    desc: "Anleitungen von Team und Community für den Einstieg." },

  /* ===== Allgemein ===== */
  { id: "allgemein", group: "Allgemein", icon: "chat", title: "Allgemeine Diskussion",
    desc: "Alles rund um Mavo City." },
  { id: "vorschlaege", group: "Allgemein", icon: "lightbulb", title: "Vorschläge",
    desc: "Ideen für Server, Scripts und Community.", statuses: true,
    template: "**Mein Vorschlag:**\n\n\n**Warum wäre das gut für den Server?**\n\n\n**Gibt es Nachteile?**\n" },
  { id: "medien", group: "Allgemein", icon: "camera", title: "Screenshots & Videos",
    desc: "Zeigt eure besten Momente aus der Stadt." },
  { id: "offtopic", group: "Allgemein", icon: "gamepad", title: "Off-Topic",
    desc: "Alles, was nichts mit dem Server zu tun hat." },

  /* ===== Support & Beschwerden ===== */
  { id: "support", group: "Support & Beschwerden", icon: "wrench", title: "Technischer Support & Bugs",
    desc: "Probleme beim Verbinden, Fehler und Bugs melden.", statuses: true,
    template: "**Discord-Name:**\n**Ingame-Name:**\n**Was ist passiert?**\n\n**Wann ist es passiert? (Datum, Uhrzeit)**\n\n**Screenshot / Video (Link):**\n" },
  { id: "beschwerden-spieler", group: "Support & Beschwerden", icon: "flag", title: "Beschwerden über Spieler",
    desc: "Regelverstöße anderer Spieler melden – nur mit Beweisen.", statuses: true,
    template: "**Dein Ingame-Name:**\n**Name des Spielers:**\n**Datum & Uhrzeit:**\n**Verstoß gegen Regel (§):**\n\n**Was ist passiert?**\n\n\n**Beweis (Video-Link, Pflicht):**\n" },
  { id: "beschwerden-team", group: "Support & Beschwerden", icon: "shield", title: "Beschwerden über Teammitglieder",
    desc: "Fehlverhalten eines Teammitglieds melden – wird von der Projektleitung bearbeitet.", statuses: true,
    template: "**Dein Ingame-Name:**\n**Name des Teammitglieds:**\n**Datum & Uhrzeit:**\n\n**Was ist passiert?**\n\n\n**Beweis (Video-Link):**\n" },
  { id: "entbannung", group: "Support & Beschwerden", icon: "lock", title: "Entbannungsanträge",
    desc: "Hier kannst du einen Antrag auf Entbannung stellen.", statuses: true,
    template: "**Discord-Name:**\n**Ingame-Name:**\n**Datum des Banns:**\n**Grund des Banns:**\n**Gebannt von (falls bekannt):**\n\n**Warum sollten wir dich entbannen?**\n" },

  /* ===== Bewerbungen ===== */
  { id: "bewerbungen", group: "Bewerbungen", icon: "file", title: "Team-Bewerbungen",
    desc: "Bewirb dich als Supporter, Moderator oder Entwickler.", statuses: true,
    template: "**Name / Alter:**\n**Discord-Name:**\n**Spielzeit auf Mavo City:**\n**Erfahrung (RP & Team):**\n\n**Warum möchtest du ins Team?**\n\n\n**Wie viel Zeit kannst du investieren?**\n" },
  { id: "bewerbungen-fraktionen", group: "Bewerbungen", icon: "users", title: "Fraktions-Bewerbungen",
    desc: "Bewerbungen für LSPD, Rettungsdienst, Justiz und weitere.", statuses: true,
    template: "**Fraktion:**\n**Ingame-Name / Alter (Charakter):**\n**Discord-Name:**\n\n**Lebenslauf deines Charakters:**\n\n\n**Warum diese Fraktion?**\n" },

  /* ===== Fraktionen & Wirtschaft ===== */
  { id: "fraktionen", group: "Fraktionen & Wirtschaft", icon: "building", title: "Staatliche Fraktionen",
    desc: "Vorstellungen und Infos von LSPD, Rettungsdienst und Justiz." },
  { id: "crime", group: "Fraktionen & Wirtschaft", icon: "mask", title: "Gangs & Organisationen",
    desc: "Vorstellungen krimineller Gruppierungen (im RP)." },
  { id: "unternehmen", group: "Fraktionen & Wirtschaft", icon: "store", title: "Unternehmen & Marktplatz",
    desc: "Firmen stellen sich vor, Stellenanzeigen und Handel." },
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

/* ---------- Hintergrundbilder Startseite ----------
   Eigene Screenshots in assets/ legen und eintragen, z.B. "assets/hero1.jpg".
   Mehrere Bilder wechseln automatisch. Leer = Skyline-Grafik.          */
const HERO_IMAGES = [];

/* ---------- Events ----------
   date: "JJJJ-MM-TTTHH:MM" (deutsche Zeit)                            */
const EVENTS = [
  { title: "Großes Autotreffen", date: "2026-11-14T20:00", location: "Hafen, Pier 3", type: "Treffen", desc: "Zeigt eure schönsten Fahrzeuge. Preise für die drei besten Builds." },
  { title: "Straßenrennen „Night Run“", date: "2026-11-21T21:00", location: "Start: Innenstadt", type: "Rennen", desc: "Legales Rennen mit Absperrung durch das LSPD. Anmeldung im Discord." },
  { title: "Tag der offenen Tür LSPD", date: "2026-11-28T18:00", location: "Polizeirevier Mission Row", type: "Fraktion", desc: "Lerne das LSPD kennen und bewirb dich direkt vor Ort." },
];

/* ---------- Wiki / Guides ----------
   content unterstützt einfache Formatierung:
   # Überschrift, **fett**, *kursiv*, [Link](https://…), - Liste, > Zitat, | Tabelle |   */
const WIKI = [
  {
    id: "einstieg", icon: "flag", title: "Erste Schritte", category: "Einsteiger",
    content: `# Willkommen in Mavo City!

Nach der Einreise landest du am **Flughafen**. Von dort aus geht es los:

- Hol dir am Rathaus deinen **Personalausweis**
- Such dir beim Jobcenter einen ersten Job
- Kauf dir ein Handy im Elektroladen

> Tipp: Frag andere Spieler nach dem Weg – das ist gutes RP!`,
  },
  {
    id: "tasten", icon: "keyboard", title: "Tastenbelegung", category: "Einsteiger",
    content: `# Wichtige Tasten

| Taste | Funktion |
| --- | --- |
| F1 | Handy |
| F2 | Inventar |
| F3 | Interaktionsmenü |
| M | Fahrzeug abschließen |
| N | Funk (Push-to-Talk) |
| X | Hände hoch |`,
  },
  {
    id: "jobs", icon: "briefcase", title: "Jobs & Verdienst", category: "Wirtschaft",
    content: `# Legale Jobs

- **Müllabfuhr** – guter Einstieg, kein Führerschein nötig
- **Taxi** – Führerschein Klasse B
- **Trucker** – Führerschein Klasse C, gutes Gehalt
- **Fischer** – entspannt, Boot erforderlich

Mehr Geld verdienst du in einer **Fraktion** oder mit einer eigenen Firma.`,
  },
  {
    id: "strafkatalog", icon: "scale", title: "Strafkatalog", category: "Regeln",
    content: `# Strafkatalog (Auszug)

| Vergehen | Strafe | Haft |
| --- | --- | --- |
| Geschwindigkeitsüberschreitung | 500 $ | – |
| Fahren ohne Führerschein | 2.500 $ | – |
| Beamtenbeleidigung | 3.000 $ | 5 Min. |
| Diebstahl | 5.000 $ | 10 Min. |
| Bewaffneter Raubüberfall | 25.000 $ | 30 Min. |

Das vollständige Gesetzbuch findest du im Discord.`,
  },
];

/* ---------- Streamer ----------
   twitch: Kanalname aus twitch.tv/KANALNAME                            */
const STREAMERS = [
  { name: "Beispiel-Streamer", twitch: "beispielkanal", desc: "Spielt einen LSPD-Officer." },
];

/* ---------- Stadtkarte ----------
   x / y: Position in Prozent (0–100) von links / oben
   type:  "staat" | "zivil" | "crime" | "job" | "freizeit"            */
const MAP_LOCATIONS = [
  { name: "Polizeirevier", type: "staat", x: 46, y: 46, desc: "Hauptquartier des LSPD." },
  { name: "Krankenhaus", type: "staat", x: 58, y: 34, desc: "Notaufnahme und Rettungswache." },
  { name: "Rathaus", type: "staat", x: 40, y: 32, desc: "Ausweis, Führerschein und Behörden." },
  { name: "Werkstatt", type: "zivil", x: 30, y: 56, desc: "Reparaturen und Tuning." },
  { name: "Autohaus", type: "zivil", x: 62, y: 58, desc: "Neu- und Gebrauchtwagen." },
  { name: "Jobcenter", type: "job", x: 50, y: 24, desc: "Hier findest du deinen ersten Job." },
  { name: "Hafen", type: "job", x: 70, y: 82, desc: "Trucker- und Fischerei-Jobs." },
  { name: "Flughafen", type: "zivil", x: 20, y: 84, desc: "Einreise für neue Bürger." },
  { name: "Strand", type: "freizeit", x: 14, y: 40, desc: "Entspannen am Meer." },
  { name: "Stadtpark", type: "freizeit", x: 52, y: 40, desc: "Treffpunkt im Grünen." },
];

/* ---------- Regel-Quiz ----------
   correct: Index der richtigen Antwort (0 = erste)                    */
const QUIZ = [
  { q: "Was bedeutet „RDM“?", answers: ["Random Deathmatch – grundloses Töten", "Roleplay des Monats", "Rennen durch die Mitte"], correct: 0 },
  { q: "Darfst du Informationen aus einem Livestream im RP nutzen?", answers: ["Ja, wenn es hilft", "Nein, das ist Metagaming", "Nur als Polizist"], correct: 1 },
  { q: "Was tust du, wenn du einen Bug findest?", answers: ["Ausnutzen, solange es geht", "Anderen davon erzählen", "Über ein Support-Ticket melden"], correct: 2 },
  { q: "Wie alt musst du mindestens sein?", answers: ["16 Jahre", "18 Jahre", "21 Jahre"], correct: 1 },
  { q: "Was ist „Powergaming“?", answers: ["Anderen Spielern Aktionen aufzwingen", "Sehr viel spielen", "Mit gutem PC spielen"], correct: 0 },
  { q: "Wie viele Personen dürfen maximal an einer Aktion teilnehmen?", answers: ["4", "6", "Unbegrenzt"], correct: 1 },
];

/* ---------- Umfrage (nur Demo-Modus; mit Supabase im Admin-Bereich verwalten) ---------- */
const DEMO_POLL = {
  id: "demo-poll-1",
  question: "Welches Event wollt ihr als Nächstes?",
  options: ["Autotreffen", "Bankraub-Event", "Strandparty", "Bootsrennen"],
};
