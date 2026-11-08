# Mavo City Website – Anleitung

Die Seite ist eine statische Website für **GitHub Pages** (Domain: mavocity.com).
Alle Funktionen laufen sofort im **Demo-Modus**. Mit **Supabase** (kostenlos, ca. 15 Minuten Einrichtung)
werden Forum, Admin-Bereich, Umfragen und Quiz-Ergebnisse „echt“ und für alle Besucher gespeichert.

| Datei | Was steht drin |
|---|---|
| `js/config.js` | Join-Code, Server-IP, Discord, Supabase-Keys, Tebex, Twitch, Sprache, Karte |
| `js/data.js` | Standard-Inhalte: News, Team, Fraktionen, Galerie, Updates, Events, Wiki, Streamer, Karte, Quiz, Spenden |
| `admin.html` | Admin-Bereich: Inhalte ohne Code bearbeiten, Meldungen, Umfragen, Quiz-Ergebnisse |

## Ordnerstruktur

```
index.html            Hauptseite mit allen Tabs
admin.html            Admin-Bereich
impressum.html        Impressum
datenschutz.html      Datenschutzerklärung
404.html              Fehlerseite
robots.txt, sitemap.xml   für Suchmaschinen

css/style.css         Grund-Design, Header, Startseite
css/pages.css         Fraktionen, Galerie, Updates, Spenden, Discord-Widget, Navigation "Mehr"
css/features.css      Wiki, Events, Karte, Streamer, Quiz, Umfragen, Formatierung
css/forum.css         Forum
css/admin.css         Admin-Bereich
css/legal.css         Impressum & Datenschutz

js/config.js          Einstellungen
js/data.js            Standard-Inhalte
js/i18n.js            Übersetzungen Deutsch/Englisch
js/supabase.js        Verbindung zur Datenbank + Discord-Login
js/content.js         lädt Inhalte (Admin-Bereich überschreibt data.js)
js/markdown.js        Text-Formatierung (Forum, Wiki)
js/main.js            Tab-System, Verbinden, Server-Status, Spielerliste, Discord-Widget
js/pages.js           News, Team, Fraktionen, Galerie, Updates, Spenden
js/events.js          Events mit Countdown und Kalender-Export
js/wiki.js            Wiki
js/map.js             Stadtkarte
js/streamers.js       Streamer + Twitch-Live-Status
js/quiz.js            Regel-Quiz
js/polls.js           Umfrage auf der Startseite
js/forum.js           Forum
js/admin.js           Admin-Bereich
js/legal.js           Helfer für Impressum/Datenschutz

supabase/schema.sql               Datenbank (einmal im SQL-Editor ausführen)
supabase/functions/twitch-live/   Twitch-Live-Abfrage (optional)
assets/                           Logo, Favicon, Skyline, Karte, Vorschaubild, Galerie-Bilder
```

---

## 1. Supabase einrichten (Forum, Admin-Bereich, Umfragen, Quiz)

1. **Projekt anlegen:** Auf [supabase.com](https://supabase.com) kostenlos registrieren → *New project* → Region **Frankfurt (eu-central-1)**.
2. **Datenbank anlegen:** Links *SQL Editor* → kompletten Inhalt von `supabase/schema.sql` einfügen → *Run*.
   (Das Skript kann später nach Updates einfach erneut ausgeführt werden.)
3. **Discord-App erstellen:**
   - [discord.com/developers/applications](https://discord.com/developers/applications) → *New Application* → Name „Mavo City“.
   - Links *OAuth2* → **Client ID** und **Client Secret** kopieren.
   - Unter *Redirects* eintragen: `https://DEIN-PROJEKT.supabase.co/auth/v1/callback`
4. **Discord-Login aktivieren:** Supabase → *Authentication* → *Sign In / Providers* → **Discord** → aktivieren, Client ID + Secret einfügen.
5. **Website erlauben:** Supabase → *Authentication* → *URL Configuration*:
   - *Site URL*: `https://mavocity.com`
   - *Redirect URLs*: `https://mavocity.com` und `https://mavocity.com/admin.html`
6. **Keys eintragen:** Supabase → *Project Settings* → *API* → **Project URL** und **anon public** Key in `js/config.js`:
   ```js
   supabaseUrl: "https://DEIN-PROJEKT.supabase.co",
   supabaseAnonKey: "eyJ...",
   ```
   Der anon-Key darf öffentlich sein. Den **service_role**-Key **niemals** eintragen!
7. **Dich zum Admin machen:** Auf `mavocity.com/admin.html` mit Discord anmelden – die Seite zeigt dir den
   fertigen SQL-Befehl mit deiner ID. Im SQL-Editor ausführen und Seite neu laden.

### Wer darf was?

| | Gast | Angemeldet (Discord) | Admin |
|---|---|---|---|
| Forum lesen | ✅ | ✅ | ✅ |
| Thema erstellen / antworten | – | ✅ (nicht in Ankündigungen) | ✅ |
| Eigene Beiträge bearbeiten / löschen | – | ✅ | ✅ (auch fremde) |
| Beiträge melden | – | ✅ | ✅ |
| Abstimmen, Quiz-Ergebnis speichern | – | ✅ | ✅ |
| Anpinnen, sperren, Inhalte bearbeiten, Meldungen, Umfragen | – | – | ✅ |

**Spam-Schutz:** max. 1 Beitrag alle 20 Sekunden und 1 neues Thema alle 2 Minuten (gilt nicht für Admins).

---

## 2. Admin-Bereich (`mavocity.com/admin.html`)

- **Inhalte:** News, Events, Updates, Wiki, Team, Fraktionen, Galerie, Startseiten-Bilder, Karte, Streamer,
  Regel-Quiz und Spenden-Pakete mit Formularen bearbeiten. *Speichern & veröffentlichen* → sofort live.
  Bilder können direkt hochgeladen werden (max. 5 MB). Orte auf der Karte per Klick positionieren.
- **Meldungen:** gemeldete Forenbeiträge ansehen, erledigen oder löschen.
- **Umfragen:** neue Umfrage starten (erscheint auf der Startseite), beenden, Ergebnisse sehen.
- **Quiz-Ergebnisse:** wer das Regel-Quiz bestanden hat – praktisch für Whitelist-Anträge.
- *Auf Standard zurücksetzen* stellt die Inhalte aus `js/data.js` wieder her.

**Ohne Supabase** funktioniert der Editor auch: Statt Speichern gibt es den Knopf *Code für data.js erzeugen*.
Den Code in `js/data.js` einfügen und hochladen.

---

## 3. Discord-Benachrichtigung bei neuen Forenthemen

1. Discord → Kanal-Einstellungen → *Integrationen* → *Webhooks* → *Neuer Webhook* → URL kopieren.
2. Im Supabase SQL-Editor ausführen:
   ```sql
   insert into public.app_settings (key, value) values
     ('discord_webhook_url', 'https://discord.com/api/webhooks/...'),
     ('site_url', 'https://mavocity.com')
   on conflict (key) do update set value = excluded.value;
   ```
Die Webhook-URL ist in der Datenbank versteckt und für Besucher **nicht** sichtbar.

---

## 4. Discord-Widget (Online-Anzeige)

Discord → Servereinstellungen → **Widget** → *Server-Widget aktivieren* → **Server-ID** in `js/config.js` bei `discordServerId`.

---

## 5. Streamer & Twitch-Live-Erkennung (optional)

Streamer im Admin-Bereich (oder `js/data.js` → `STREAMERS`) eintragen. „Stream ansehen“ funktioniert sofort.

Damit automatisch angezeigt wird, **wer gerade live ist**:
1. Auf [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) eine Anwendung registrieren
   (OAuth-Redirect: `https://mavocity.com`, Kategorie: Website-Integration) → **Client-ID** und **Client-Secret**.
2. Supabase → *Edge Functions* → *Deploy a new function* → Name `twitch-live` → Inhalt von
   `supabase/functions/twitch-live/index.ts` einfügen → bei *Enforce JWT verification* den Haken **entfernen** → *Deploy*.
3. Supabase → *Edge Functions* → *Secrets*: `TWITCH_CLIENT_ID` und `TWITCH_CLIENT_SECRET` anlegen.
4. In `js/config.js`: `twitchLiveCheck: true`.

---

## 6. Inhalte ohne Admin-Bereich ändern (`js/data.js`)

- **Events:** `date: "2026-11-14T20:00"` (deutsche Zeit). Vergangene Events werden automatisch ausgegraut.
- **Wiki:** `content` mit Formatierung: `# Überschrift`, `**fett**`, `*kursiv*`, `- Liste`, `> Zitat`, `[Link](https://…)`, Tabellen mit `| a | b |`.
  Link auf einen Artikel: `#wiki/artikel-id`.
- **Galerie:** Bild in `assets/gallery/` legen → `{ type: "image", src: "assets/gallery/bild.jpg", title: "…" }`
  oder Video: `{ type: "video", youtubeId: "ABC123", title: "…" }`.
- **Startseiten-Bilder:** `HERO_IMAGES = ["assets/hero1.jpg", "assets/hero2.jpg"]` – wechseln alle 7 Sekunden.
- **Karte:** `x`/`y` = Position in Prozent. Eigenes Kartenbild: `mapImage: "assets/map.jpg"` in `js/config.js`.
- **Quiz:** `correct` = Nummer der richtigen Antwort, **beginnend bei 0**. Bestehensgrenze: `quizPassPercent` in der Config.

---

## 7. Spenden / Tebex

FiveM-Server dürfen Geld nur über **Tebex** annehmen (Cfx.re-Regeln). Store auf [tebex.io](https://tebex.io) anlegen,
mit dem Server verbinden und die Store-Adresse in `js/config.js` bei `tebexUrl` eintragen. Nur kosmetische Pakete – kein Pay2Win.

---

## 8. Sprachen

Oben rechts kann zwischen **Deutsch und Englisch** gewechselt werden; die Auswahl wird gespeichert.
Direkter Link zur englischen Version: `mavocity.com/?lang=en`.
Feste Texte stehen in `js/i18n.js`. Inhalte aus dem Admin-Bereich (News, Wiki …) werden **nicht** automatisch übersetzt.

---

## 9. Impressum & Datenschutz

`impressum.html` und `datenschutz.html` enthalten **rot markierte Platzhalter** (`<span class="ph">[…]</span>`).
Durch echte Daten ersetzen und das `<span class="ph">` entfernen.
Bei neuen externen Diensten muss die Datenschutzerklärung ergänzt werden. Die Texte sind eine Vorlage, keine Rechtsberatung.

---

## 10. Suchmaschinen

`sitemap.xml` und `robots.txt` liegen im Hauptordner. In der [Google Search Console](https://search.google.com/search-console)
die Domain hinzufügen und `https://mavocity.com/sitemap.xml` einreichen.

## 11. Design „Clean Premium“

- **Farben** stehen ganz oben in `css/style.css` (`:root` = dunkel, `[data-theme="light"]` = hell).
  Die Goldfarbe ändern: `--accent`, `--accent-2`, `--accent-ink`.
- **Hell/Dunkel:** Besucher schalten oben rechts um (Sonne/Mond); die Wahl wird gespeichert. Standard ist dunkel.
- **Schrift:** Überschriften nutzen *Inter Display* aus `assets/fonts/` (liegt auf eurem Server, DSGVO-konform,
  Lizenz: `assets/fonts/LICENSE-Inter.txt`). Fließtext nutzt die Systemschrift.
- **Symbole:** `assets/icons.svg`. In `js/data.js` und im Admin-Bereich steht bei `icon` ein Name wie
  `shield`, `medkit`, `scale`, `wrench`, `mask`, `heart`, `star`, `trophy` … (Liste oben in `js/data.js`).
- **Logo:** `assets/logo.svg` und `assets/favicon.svg`. Vorschaubild für Discord/WhatsApp: `assets/og-image.png` (1200 × 630).
- **Startseite mit Video:** kurzes, stummes `.mp4` (am besten < 8 MB) nach `assets/` legen und in `js/config.js`
  `heroVideo: "assets/hero.mp4"` eintragen (optional `heroVideoPoster` als Standbild).
  Alternativ Bilder über Admin → *Startseiten-Bilder*.
- **Navigation:** Start · Spielen ▾ · Forum · Community ▾ · Wissen ▾. Auf Handy/Tablet gibt es unten eine Leiste
  (Start, Spielen, Forum, Events, Menü).
