// ==========================================================
// Mavo City – Unterseiten für Google erzeugen
//
// Erstellt aus index.html eigene Seiten wie /regeln/, /forum/,
// /fraktionen/ … mit passendem Titel, Beschreibung und Link-Vorschau.
// Inhalt und Funktionen sind identisch mit der Hauptseite.
//
// Nach JEDER Änderung an index.html ausführen:
//     node tools/build-pages.mjs
// (Inhalte aus dem Admin-Bereich oder js/data.js brauchen das nicht.)
// ==========================================================
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://mavocity.com";

const PAGES = {
  verbinden:  ["So kommst du auf den Server", "Schritt für Schritt auf Mavo City: GTA V, FiveM installieren, Regeln lesen und direkt verbinden – ohne Whitelist."],
  regeln:     ["Regelwerk", "Das Regelwerk von Mavo City: Allgemeines, Roleplay (RDM, VDM, Metagaming, Powergaming), Fraktionen, Crime und Technik."],
  fraktionen: ["Fraktionen", "LSPD, Rettungsdienst, Justiz, Werkstatt und Gangs auf Mavo City – Voraussetzungen und Bewerbung direkt auf der Website."],
  status:     ["Server-Status", "Ist Mavo City online? Spieler online, Neustart-Zeiten und wann am meisten auf dem Server los ist."],
  forum:      ["Forum", "Das Forum von Mavo City: Ankündigungen, Vorschläge, Support, Beschwerden und Bewerbungen."],
  buerger:    ["Bürgerregister", "Die Charaktere von Mavo City – Spieler stellen ihre Rollen mit Bild und Hintergrundgeschichte vor."],
  events:     ["Events", "Kommende Events auf Mavo City – mit Countdown, Anmeldung und Kalender-Export."],
  wiki:       ["Wiki & Guides", "Erste Schritte, Tastenbelegung, Jobs und Strafkatalog – das Wiki für deinen Start in Mavo City."],
  karte:      ["Stadtkarte", "Die wichtigsten Orte in Mavo City: Polizeirevier, Krankenhaus, Rathaus, Jobcenter und mehr."],
  galerie:    ["Galerie", "Screenshots und Clips aus Mavo City."],
  streamer:   ["Streamer", "Streamer, die das Leben in Mavo City zeigen – live auf Twitch."],
  quiz:       ["Regel-Quiz", "Teste dein Wissen über das Regelwerk von Mavo City."],
  updates:    ["Updates", "Changelog von Mavo City – was sich auf dem Server geändert hat."],
  team:       ["Team", "Das Team hinter Mavo City."],
  faq:        ["Häufige Fragen", "Antworten auf häufige Fragen zu Mavo City: Whitelist, Mindestalter, Verbindungsprobleme, Team-Bewerbung, Spenden."],
  spenden:    ["Unterstützen", "Mavo City unterstützen – rein kosmetische Pakete, kein Pay2Win."],
};

const src = readFileSync(join(ROOT, "index.html"), "utf8");
const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function must(html, from, to, slug) {
  if (!html.includes(from)) throw new Error(`[${slug}] nicht gefunden: ${from.slice(0, 60)}`);
  return html.replace(from, to);
}

for (const [slug, [name, desc]] of Object.entries(PAGES)) {
  const url = `${SITE}/${slug}/`;
  const title = `${name} – Mavo City`;
  let html = src;
  // Alle relativen Pfade (css/, js/, assets/) zeigen auf die Hauptebene
  html = must(html, '<meta charset="UTF-8">', '<meta charset="UTF-8">\n  <base href="../">', slug);
  html = must(html, "<title>Mavo City – FiveM Roleplay</title>", `<title>${attr(title)}</title>`, slug);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(desc)}">`);
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
  html = html.replace(/<link rel="alternate" hreflang="de" href="[^"]*">/, `<link rel="alternate" hreflang="de" href="${url}">`);
  html = html.replace(/<link rel="alternate" hreflang="en" href="[^"]*">/, `<link rel="alternate" hreflang="en" href="${url}?lang=en">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${attr(title)}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${attr(desc)}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
  html = must(html, "<body>", `<body data-page="${slug}">`, slug);
  // Ohne JavaScript (z. B. einfache Crawler) direkt den richtigen Bereich zeigen
  html = must(html, '<section id="start" class="panel" role="tabpanel">', '<section id="start" class="panel" role="tabpanel" hidden>', slug);
  html = must(html, `<section id="${slug}" class="panel" role="tabpanel" hidden>`, `<section id="${slug}" class="panel" role="tabpanel">`, slug);
  html = must(html, "<!DOCTYPE html>", "<!DOCTYPE html>\n<!-- Automatisch erzeugt von tools/build-pages.mjs – nicht von Hand bearbeiten, sondern index.html ändern. -->", slug);

  const file = join(ROOT, slug, "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// Sitemap
const today = new Date().toISOString().slice(0, 10);
const urls = [
  `  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
  ...Object.keys(PAGES).map((s) => `  <url><loc>${SITE}/${s}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${["verbinden", "regeln", "fraktionen", "status"].includes(s) ? "0.9" : "0.7"}</priority></url>`),
  `  <url><loc>${SITE}/impressum.html</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>`,
  `  <url><loc>${SITE}/datenschutz.html</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>`,
];
writeFileSync(join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);

console.log(`${Object.keys(PAGES).length} Unterseiten + sitemap.xml erzeugt.`);
