# Mavo City Website – Anleitung

Die Seite ist eine statische Website für **GitHub Pages** (Domain: mavocity.com).
Alles, was du regelmäßig änderst, steht in **zwei Dateien**:

| Datei | Was steht drin |
|---|---|
| `js/config.js` | Join-Code, Server-IP, Discord-Link, Supabase-Keys, Tebex-Shop, Social Media |
| `js/data.js` | News, Team, Fraktionen, Galerie, Updates, Spenden-Pakete, Forum-Kategorien |

## Ordnerstruktur

```
index.html          Aufbau der Seite (alle Tabs)
css/style.css       Grund-Design, Header, Startseite
css/pages.css       Fraktionen, Galerie, Updates, Spenden, Discord-Widget
css/forum.css       Forum
js/config.js        Einstellungen
js/data.js          Inhalte
js/main.js          Tab-System, Verbinden, Server-Status, Discord-Widget
js/pages.js         Fraktionen, Galerie, Updates, Spenden, Team, News
js/forum.js         Forum (Supabase oder Demo-Modus)
supabase/schema.sql Datenbank für das Forum
assets/             Logo, Favicon, Skyline, Vorschaubild, Galerie-Bilder
```

---

## 1. Forum mit Discord-Login einrichten (Supabase, kostenlos)

Ohne diese Schritte läuft das Forum im **Demo-Modus**: Dann sieht jeder Besucher nur seine eigenen Beiträge.

1. **Supabase-Projekt anlegen**
   Auf [supabase.com](https://supabase.com) kostenlos registrieren → *New project* → Region *Frankfurt (eu-central-1)* wählen.

2. **Datenbank anlegen**
   Im Projekt links auf *SQL Editor* → Inhalt von `supabase/schema.sql` komplett einfügen → *Run*.

3. **Discord-App erstellen**
   - [discord.com/developers/applications](https://discord.com/developers/applications) → *New Application* → Name „Mavo City“.
   - Links *OAuth2* → **Client ID** und **Client Secret** kopieren.
   - Unter *Redirects* eintragen: `https://DEIN-PROJEKT.supabase.co/auth/v1/callback`
     (die genaue Adresse steht in Supabase beim Discord-Provider, siehe nächster Schritt).

4. **Discord-Login in Supabase aktivieren**
   Supabase → *Authentication* → *Sign In / Providers* → **Discord** → aktivieren, Client ID und Secret einfügen → speichern.

5. **Website-Adresse erlauben**
   Supabase → *Authentication* → *URL Configuration*:
   - *Site URL*: `https://mavocity.com`
   - *Redirect URLs*: `https://mavocity.com` hinzufügen

6. **Keys in die Website eintragen**
   Supabase → *Project Settings* → *API* (bzw. *Data API*) → **Project URL** und den **anon public** Key kopieren.
   In `js/config.js` eintragen:
   ```js
   supabaseUrl: "https://DEIN-PROJEKT.supabase.co",
   supabaseAnonKey: "eyJ...",
   ```
   Der anon-Key darf öffentlich sein, die Datenbank ist über Sicherheitsregeln (RLS) geschützt.
   Den **service_role**-Key darfst du **niemals** eintragen.

7. **Dich selbst zum Admin machen**
   Einmal auf der Website mit Discord anmelden. Dann in Supabase → *Authentication* → *Users* deine **UID** kopieren
   und im *SQL Editor* ausführen:
   ```sql
   insert into public.forum_admins (user_id) values ('DEINE-UID');
   ```
   Admins können Themen anpinnen, sperren und löschen, fremde Beiträge löschen und in „Ankündigungen“ schreiben.

**Wer darf was im Forum?**

| | Gast | Angemeldet (Discord) | Admin |
|---|---|---|---|
| Lesen | ✅ | ✅ | ✅ |
| Thema erstellen / antworten | – | ✅ (nicht in Ankündigungen) | ✅ |
| Eigene Antworten löschen | – | ✅ | ✅ |
| Anpinnen, sperren, alles löschen | – | – | ✅ |

---

## 2. Discord-Widget (Online-Anzeige auf der Startseite)

1. Discord → Servereinstellungen → **Widget** → *Server-Widget aktivieren*.
2. Dort die **Server-ID** kopieren und in `js/config.js` bei `discordServerId` eintragen.

Danach zeigt die Startseite, wie viele Mitglieder online sind, und ihre Profilbilder.

---

## 3. Galerie füllen

1. Bilder (am besten `.jpg`, ca. 1600 px breit) in den Ordner `assets/gallery/` hochladen.
2. In `js/data.js` bei `GALLERY` eintragen:
   ```js
   { type: "image", src: "assets/gallery/stadt.jpg", title: "Stadtansicht bei Nacht" },
   { type: "video", youtubeId: "ABC123xyz", title: "Server-Trailer" },
   ```
   Die YouTube-ID ist der Teil nach `watch?v=` in der Video-URL.

---

## 4. Spenden / Tebex

FiveM-Server dürfen Geld nur über **Tebex** annehmen (Cfx.re-Regeln).
1. Auf [tebex.io](https://tebex.io) einen Store anlegen und mit deinem FiveM-Server (Keymaster) verbinden.
2. Store-Adresse in `js/config.js` bei `tebexUrl` eintragen.
3. Pakete und Preise in `js/data.js` bei `DONATION_PACKAGES` anpassen. Bitte nur **kosmetische** Vorteile, kein Pay2Win.

---

## 5. Updates / Changelog

Neue Version in `js/data.js` **oben** in `CHANGELOG` einfügen:
```js
{
  version: "1.2.0", date: "15.11.2026", title: "Neue Jobs",
  items: [
    { type: "neu", text: "Taxi-Job hinzugefügt" },
    { type: "fix", text: "Garage-Bug behoben" },
    { type: "änderung", text: "Gehalt LSPD angepasst" },
  ],
},
```

---

## 6. Logo austauschen

`assets/logo.svg` und `assets/favicon.svg` durch eigene Dateien ersetzen (gleicher Name).
`assets/og-image.png` (1200 × 630 px) ist das Vorschaubild, wenn jemand den Link in Discord oder WhatsApp teilt.
