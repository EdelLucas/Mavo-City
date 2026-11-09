/* ==========================================================
   Mavo City – Sprachen (Deutsch / Englisch)

   Statische Texte:  <h1 data-i18n="join.title">…</h1>
                     -> Deutsch steht im HTML, Englisch in EN.keys
   Texte im Code:    t("Deutscher Text", { n: 3 })
                     -> Englisch in EN.text (Schlüssel = deutscher Text)

   Inhalte aus dem Admin-Bereich / data.js (News, Wiki usw.)
   werden nicht automatisch übersetzt.
   ========================================================== */
(() => {
  const EN = {
    keys: {
      "nav.start": "Home",
      "nav.join": "How to join",
      "nav.play": "Play",
      "nav.community": "Community",
      "nav.info": "Knowledge",
      "wiki.navTitle": "Wiki &amp; guides",
      "bn.play": "Play",
      "bn.menu": "Menu",
      "eb.play": "Play",
      "eb.community": "Community",
      "eb.info": "Knowledge",
      "nav.rules": "Rules",
      "nav.factions": "Factions",
      "nav.more": "More",
      "nav.map": "City map",
      "nav.gallery": "Gallery",
      "nav.quiz": "Rules quiz",
      "nav.support": "Support us",
      "cta.play": "Play now",

      "hero.title": 'Your story begins in <span class="gold-text">Mavo City</span>.',
      "hero.lead": "Serious German roleplay with a player-driven economy, active factions and a staff team that listens.",
      "hero.howto": "How to join",
      "discord.join": "Join Discord",
      "discord.come": "Come say hi!",
      "stats.online": "Players online",
      "stats.age": "Minimum age",
      "stats.who": "Who is online right now?",

      "start.expect": "What to expect",
      "start.eyebrow1": "The city",
      "start.eyebrow2": "Latest",
      "start.eyebrow3": "Coming up",
      "cta.title": "Ready for the city?",
      "cta.text": "Read the rules, pass the quiz and start your story in just a few minutes.",
      "start.card1": "<h3>Government factions</h3><p>Police, EMS and justice with training, ranks and real procedures.</p>",
      "start.card2": "<h3>Player economy</h3><p>Start companies, buy property, trade – the city lives through its citizens.</p>",
      "start.card3": "<h3>Crime with depth</h3><p>Gangs and organisations with territories, reputation and consequences.</p>",
      "start.news": "News",
      "start.allUpdates": "See all updates",
      "start.nextEvent": "Next event",
      "start.poll": "Poll",

      "join.title": "How to join the server",
      "join.lead": "You'll be in the city in a few minutes. Just follow these steps.",
      "join.s1": "<h3>Own GTA V</h3><p>You need a legal copy of <strong>GTA V</strong> (Steam, Epic Games or Rockstar Launcher).</p>",
      "join.s2": "<h3>Install FiveM</h3><p>Download FiveM from the official website and install it.</p>",
      "join.s2btn": "Open fivem.net",
      "join.s3": "<h3>Rules quiz &amp; whitelist</h3><p>Read the rules, pass our short <strong>rules quiz</strong> and then apply in the <code>#whitelist</code> channel on Discord.</p>",
      "join.s3quiz": "Take the rules quiz",
      "join.s3discord": "Go to Discord",
      "join.s4": "<h3>Connect</h3><p>Click <em>Connect directly</em> or open the FiveM console with <kbd>F8</kbd> and enter:</p>",
      "join.copy": "Copy",
      "join.direct": "Connect directly",
      "join.help": "<strong>Trouble connecting?</strong> Clear your cache (delete <code>%localappdata%/FiveM/FiveM.app/data/cache</code>), restart FiveM or open a support ticket on Discord.",

      "rules.title": "Rules",
      "rules.lead": "By joining the server you accept these rules. Not knowing them is no excuse.",
      "rules.r1": "<summary>§1 General</summary><ul><li>Treat all players and staff with respect.</li><li>Racism, sexism and discrimination lead to a permanent ban.</li><li>Minimum age 18.</li></ul>",
      "rules.r2": "<summary>§2 Roleplay</summary><ul><li><strong>Fail-RP</strong>: Unrealistic behaviour is not allowed.</li><li><strong>RDM / VDM</strong>: Killing or running people over without reason is not allowed.</li><li><strong>Metagaming</strong>: Out-of-character knowledge must not be used in RP.</li><li><strong>Powergaming</strong>: Don't force actions on others.</li></ul>",
      "rules.r3": "<summary>§3 Factions &amp; crime</summary><ul><li>Robberies only with enough officers on duty.</li><li>Hostage situations only with prior RP.</li><li>A maximum of 6 people per group in actions.</li></ul>",
      "rules.r4": "<summary>§4 Technical</summary><ul><li>Cheats, mod menus and exploits = permanent ban.</li><li>Please report bugs via a support ticket.</li><li>A working microphone is required.</li></ul>",
      "rules.penalties": "See the penalty catalogue in the wiki",

      "factions.lead": "Find your place in the city – in public service, as an entrepreneur or on the other side of the law.",
      "factions.all": "All",
      "factions.state": "Government",
      "factions.civil": "Civilian",

      "forum.lead": "Talk with the community, ask questions or apply.",
      "wiki.title": "Wiki &amp; guides",
      "wiki.lead": "Everything you need to know to get started in Mavo City.",
      "events.lead": "What's happening in the city soon. Add events to your calendar with one click.",
      "map.lead": "The most important places in the city. Tap a marker for details.",
      "gallery.lead": "Impressions from Mavo City – screenshots and clips from the community.",
      "streamer.lead": "These streamers show life in Mavo City. Check them out!",
      "quiz.lead": "Test your knowledge of the rules. Pass the quiz before applying for the whitelist.",
      "updates.lead": "What has changed on the server.",
      "team.title": "Our team",
      "team.lead": "The people behind Mavo City.",

      "faq.title": "Frequently asked questions",
      "faq.q1": '<summary>Do I need a whitelist?</summary><p>Yes. First pass the <a href="#quiz">rules quiz</a>, then apply in the <code>#whitelist</code> channel on our Discord.</p>',
      "faq.q2": "<summary>How old do I have to be?</summary><p>At least 18.</p>",
      "faq.q3": "<summary>I get an error when connecting – what now?</summary><p>Clear your cache, restart FiveM and check that you are whitelisted. If that doesn't help, open a ticket on Discord.</p>",
      "faq.q4": "<summary>Can I apply to join the staff team?</summary><p>Yes! You'll find all details in the forum under <em>Applications</em>.</p>",
      "faq.q5": '<summary>Are there donations / packages?</summary><p>Yes, but cosmetic only – donations give no gameplay advantage. More under <a href="#spenden">Support us</a>.</p>',
      "faq.q6": "<summary>Is there an English version?</summary><p>The website is available in English (button top right). On the server itself, German is spoken.</p>",

      "donate.title": "Support Mavo City",
      "donate.lead": "Servers, scripts and development cost money. A donation helps keep the city alive.",
      "donate.nop2w": "<strong>No pay-to-win – promise.</strong> All packages are purely cosmetic. You can't buy weapons, money, faster vehicles or RP advantages.",
      "donate.fine": "Payments are handled securely by <strong>Tebex</strong>, the official payment provider for FiveM servers. Donations are voluntary and non-refundable. Questions? Open a ticket on Discord.",

      "footer.disclaimer": "Not affiliated with Rockstar Games or Take-Two.",
      "footer.imprint": "Legal notice",
      "footer.legal": "Legal",
      "footer.tagline": "German FiveM roleplay with heart, rules and a community that sticks together.",
      "footer.privacy": "Privacy",
    },

    text: {
      "Abbrechen": "Cancel",
      "Abgemeldet.": "Logged out.",
      "Abmelden": "Log out",
      "Aktuell keine Bewerbungen": "Not accepting applications",
      "Aktuell sind keine Events geplant.": "No events planned right now.",
      "Alle Events ansehen": "See all events",
      "Helles Design": "Light mode",
      "Dunkles Design": "Dark mode",
      "Alle Orte": "All places",
      "Alle": "All",
      "Allgemein": "General",
      "Angemeldet als": "Logged in as",
      "Anpinnen": "Pin",
      "Antwort gesendet!": "Reply sent!",
      "Antwort senden": "Send reply",
      "Antwort": "reply",
      "Antworten": "Replies",
      "Bald verfügbar": "Coming soon",
      "Bearbeiten": "Edit",
      "Befehl kopiert – jetzt in F8 einfügen!": "Command copied – now paste it into F8!",
      "Beitrag wirklich löschen?": "Really delete this post?",
      "Beiträge": "posts",
      "Beliebt": "Popular",
      "Bestanden!": "Passed!",
      "Bewerbung geschlossen": "Applications closed",
      "Bewerbung offen": "Applications open",
      "Bitte warte 20 Sekunden zwischen zwei Beiträgen.": "Please wait 20 seconds between posts.",
      "Danke für deine Stimme!": "Thanks for voting!",
      "Danke! Das Team schaut sich den Beitrag an.": "Thanks! The team will review this post.",
      "Das Forum konnte nicht geladen werden.": "The forum could not be loaded.",
      "Dein Beitrag…": "Your post…",
      "Dein Name im Forum (z.B. dein Discord- oder Charaktername):": "Your forum name (e.g. your Discord or character name):",
      "Deine Antwort…": "Your reply…",
      "Demo – Stimme nur lokal gespeichert": "Demo – vote stored locally only",
      "Demo-Modus: Beiträge werden nur lokal in deinem Browser gespeichert.": "Demo mode: posts are only stored locally in your browser.",
      "Dieses Thema ist gesperrt.": "This thread is locked.",
      "Du brauchst mindestens {p} % richtige Antworten. Du kannst das Quiz beliebig oft wiederholen.": "You need at least {p} % correct answers. You can retake the quiz as often as you like.",
      "Du hast das Quiz bereits bestanden.": "You have already passed the quiz.",
      "Endet am": "Ends on",
      "Entsperren": "Unlock",
      "Ergebnis fürs Team speichern": "Save result for the team",
      "Ergebnis gespeichert – das Team kann es jetzt sehen.": "Result saved – the team can see it now.",
      "Ergebnis gespeichert.": "Result saved.",
      "Erst Regeln lesen": "Read the rules first",
      "Falsche Antworten ansehen ({n})": "Show wrong answers ({n})",
      "Fehler": "Error",
      "Formatierung": "Formatting",
      "Frage {a} von {b}": "Question {a} of {b}",
      "Ganzes Thema inkl. aller Antworten löschen?": "Delete the whole thread including all replies?",
      "Gerade läuft keine Umfrage.": "No poll running right now.",
      "Gespeichert.": "Saved.",
      "In Kalender eintragen": "Add to calendar",
      "Jetzt bewerben": "Apply now",
      "Karte von Mavo City": "Map of Mavo City",
      "Keine Fraktionen in dieser Kategorie.": "No factions in this category.",
      "Keine Treffer.": "No results.",
      "Kopieren nicht möglich – bitte manuell markieren.": "Copy failed – please select it manually.",
      "Leider nicht bestanden": "Not passed",
      "Lies dir das Regelwerk noch einmal durch und versuche es erneut.": "Read the rules again and try once more.",
      "Liste": "list",
      "Läuft gerade": "Happening now",
      "Löschen": "Delete",
      "Lösen": "Unpin",
      "Melde dich an, um zu antworten.": "Log in to reply.",
      "Melden ist im Demo-Modus nicht verfügbar.": "Reporting is not available in demo mode.",
      "Melden": "Report",
      "Min": "Min",
      "Mit Discord anmelden & speichern": "Log in with Discord & save",
      "Mit Discord anmelden": "Log in with Discord",
      "Mit Discord anmelden, um abzustimmen": "Log in with Discord to vote",
      "Namen festlegen": "Set name",
      "Neu": "New",
      "Neues Thema in „{c}“": "New thread in “{c}”",
      "Neues Thema": "New thread",
      "Nicht angemeldet": "Not logged in",
      "Noch keine Artikel vorhanden.": "No articles yet.",
      "Noch keine Bilder.": "No images yet.",
      "Noch keine Neuigkeiten.": "No news yet.",
      "Noch keine Streamer eingetragen.": "No streamers listed yet.",
      "Noch keine Themen hier. Starte das erste!": "No threads here yet. Start the first one!",
      "Noch nichts geschrieben.": "Nothing written yet.",
      "Nochmal": "Try again",
      "Offline": "Offline",
      "Orte": "Places",
      "Quiz starten": "Start quiz",
      "Regeln lesen": "Read the rules",
      "Schließen": "Close",
      "Sek": "Sec",
      "Server online": "Server online",
      "Shop bald verfügbar": "Shop coming soon",
      "Speichern": "Save",
      "Sperren": "Lock",
      "Staat": "Government",
      "Status unbekannt": "Status unknown",
      "Status wird geladen…": "Loading status…",
      "Std": "Hrs",
      "Stream ansehen": "Watch stream",
      "Super! Du kennst die wichtigsten Regeln. Stelle jetzt deinen Whitelist-Antrag im Discord.": "Great! You know the key rules. Now apply for the whitelist on Discord.",
      "Tage": "Days",
      "Thema erstellt!": "Thread created!",
      "Thema löschen": "Delete thread",
      "Thema nicht gefunden.": "Thread not found.",
      "Themen durchsuchen…": "Search threads…",
      "Themen": "threads",
      "Themenstart": "Original post",
      "Titel": "Title",
      "Vergangene Events": "Past events",
      "Veröffentlichen": "Publish",
      "Voraussetzungen": "Requirements",
      "Vorschau ausblenden": "Hide preview",
      "Vorschau": "Preview",
      "Warum möchtest du diesen Beitrag melden?": "Why do you want to report this post?",
      "Wiki durchsuchen…": "Search wiki…",
      "Zitat": "quote",
      "Zivil": "Civilian",
      "Zum Schreiben musst du dich mit Discord anmelden. Jetzt anmelden?": "You need to log in with Discord to post. Log in now?",
      "Zum Shop": "Go to shop",
      "Zum Whitelist-Antrag": "Apply for whitelist",
      "bearbeitet": "edited",
      "fett": "bold",
      "kursiv": "italic",
      "von": "by",
      "zuletzt": "last",
      "{n} Fragen zum Regelwerk": "{n} questions about the rules",
      "{n} Mitglieder online": "{n} members online",
      "{n} Stimmen": "{n} votes",
      "1 Stimme": "1 vote",
      "Änderung": "Change",
      // Forum (Update 3)
      "gerade eben": "just now",
      "vor {n} Min.": "{n} min ago",
      "vor {n} Std.": "{n} h ago",
      "gestern": "yesterday",
      "vor {n} Tagen": "{n} days ago",
      "Benachrichtigungen": "Notifications",
      "Alle gelesen": "Mark all read",
      "gefällt dein Beitrag in": "liked your post in",
      "hat geantwortet in": "replied in",
      "Keine Benachrichtigungen.": "No notifications.",
      "Angepinnt": "Pinned",
      "Gesperrt": "Locked",
      "Aktivität": "Activity",
      "Alle Themen durchsuchen…": "Search all threads…",
      "Offiziell": "Official",
      "Neueste Aktivität": "Latest activity",
      "Noch keine Themen.": "No threads yet.",
      "Mitglieder": "members",
      "Mitreden?": "Join the conversation?",
      "Melde dich mit Discord an, um Themen zu erstellen, zu antworten und Beiträge zu liken.": "Log in with Discord to create threads, reply and like posts.",
      "Suche": "Search",
      "Sortieren": "Sort",
      "Neueste Themen": "Newest threads",
      "Meiste Antworten": "Most replies",
      "Gib einen Suchbegriff ein.": "Enter a search term.",
      "Neues Thema erstellen": "Create a new thread",
      "Kategorie": "Category",
      "Worum geht es?": "What is it about?",
      "Beitrag": "Post",
      "Schreib deinen Beitrag…": "Write your post…",
      "Gefällt mir": "Like",
      "Zitieren": "Quote",
      "schrieb": "wrote",
      "Profil": "Profile",
      "Profil nicht gefunden.": "Profile not found.",
      "Mitglied seit": "Member since",
      "Erzähl etwas über dich oder deinen Charakter.": "Tell us about yourself or your character.",
      "Noch keine Beschreibung.": "No description yet.",
      "Beschreibung bearbeiten": "Edit description",
      "Rolle": "Role",
      "Mitglied": "Member",
      "Im Forum sperren": "Ban from forum",
      "Letzte Beiträge": "Recent posts",
      "Noch keine Beiträge.": "No posts yet.",
      "Rolle geändert.": "Role changed.",
      "{n} im Forum sperren? Die Person kann dann nichts mehr schreiben.": "Ban {n} from the forum? They will not be able to post anymore.",
      "Entsperrt.": "Unbanned.",
      "Gesperrt.": "Banned.",
      "Im Demo-Modus nicht verfügbar.": "Not available in demo mode.",
      "Legende": "Legend",
      "Urgestein": "Veteran",
      "Stammgast": "Regular",
      "Bürger": "Citizen",
      "Neuling": "Newcomer",
      "Fett": "Bold",
      "Kursiv": "Italic",
      "Überschrift": "Heading",
      "Link": "Link",
      "Bild": "Image",
      "Code": "Code",
      "Punkt": "item",
      "Linktext": "link text",
      // Karte
      "Jobs": "Jobs",
      "Freizeit": "Leisure",
      // Forum-Kategorien
      "Ankündigungen": "Announcements",
      "Offizielle Neuigkeiten vom Team.": "Official news from the team.",
      "Alles rund um Mavo City.": "Everything about Mavo City.",
      "Support & Bugs": "Support & bugs",
      "Probleme melden und Hilfe bekommen.": "Report problems and get help.",
      "Vorschläge": "Suggestions",
      "Ideen für Server und Community.": "Ideas for the server and community.",
      "Bewerbungen": "Applications",
      "Bewirb dich für Team oder Fraktionen.": "Apply for the staff team or factions.",
      "Fraktionen": "Factions",
      "Vorstellungen und Infos der Fraktionen.": "Faction introductions and info.",
    },
  };

  const KEY = "mavo_lang";
  const originals = new Map();
  let lang = CONFIG.defaultLanguage || "de";

  try {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    lang = fromUrl || localStorage.getItem(KEY) || (navigator.language?.startsWith("de") ? "de" : CONFIG.defaultLanguage) || "de";
  } catch { /* egal */ }
  if (!["de", "en"].includes(lang)) lang = "de";

  window.getLang = () => lang;

  window.t = (de, vars = {}) => {
    const s = lang === "en" ? (EN.text[de] ?? de) : de;
    return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  };

  function applyStatic() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      if (!originals.has(el)) originals.set(el, el.innerHTML);
      const en = EN.keys[el.dataset.i18n];
      el.innerHTML = lang === "en" && en ? en : originals.get(el);
    });
    const btn = document.getElementById("langSwitch");
    if (btn) {
      btn.textContent = lang === "en" ? "DE" : "EN";
      btn.title = lang === "en" ? "Auf Deutsch anzeigen" : "Show in English";
    }
  }

  window.setLang = (l) => {
    lang = l === "en" ? "en" : "de";
    try { localStorage.setItem(KEY, lang); } catch { /* egal */ }
    applyStatic();
    document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  };

  document.addEventListener("DOMContentLoaded", () => {
    applyStatic();
    document.getElementById("langSwitch")?.addEventListener("click", () => setLang(lang === "en" ? "de" : "en"));
  });
})();
