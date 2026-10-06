# 🎫 Ticket-Bot mit Dashboard

Discord-Ticket-Bot mit Web-Dashboard (Node.js, discord.js v14, SQLite).
Alles wird im Dashboard eingestellt – kein Code nötig.

## Funktionen

**Bot**
- Panels mit **Buttons** oder **Auswahlmenü** zum Öffnen von Tickets
- Mehrere Ticket-Typen, jeder mit eigenen Einstellungen: Name, Emoji, Beschreibung, Button-Farbe, Discord-Kategorie, zusätzliche Support-Rollen, Willkommensnachricht, Kanal-Name
- **Formular vor dem Ticket:** bis zu 5 Fragen pro Typ, die Antworten stehen in der ersten Nachricht
- **Rollenpflicht:** ein Typ kann nur für Mitglieder mit einer bestimmten Rolle sichtbar nutzbar sein
- **Limits:** offene Tickets pro Nutzer, global und zusätzlich pro Typ
- **Gesperrte Nutzer:** können keine Tickets öffnen
- **Auto-Close:** Tickets ohne Nachricht werden nach X Stunden geschlossen
- Privater Ticket-Kanal nur für Ersteller + Support-Rollen
- Ticket **übernehmen** (Claim), **schließen** (optional mit Bestätigung)
- **Transcript** (HTML) beim Schließen → Log-Kanal und per DM an den Ersteller
- Slash-Commands: `/ticket add`, `/ticket remove`, `/ticket rename`, `/ticket close [grund]`, `/dashboard`

**Website**
- `/` ist eine Startseite mit Funktionen, „Bot einladen“-Button und Login
- `/dashboard` ist das Dashboard (Login mit Discord)
- Alles wird vom selben Node-Prozess ausgeliefert – eine Domain, ein Server

**Dashboard**
- Login mit Discord, nur Server wo du „Server verwalten“ hast, Server-Wechsel per Dropdown
- **Übersicht:** Kennzahlen, Verlauf der letzten 14 Tage, Tickets pro Kategorie, Einrichtungs-Checkliste
- **Einstellungen:** Log-Kanal, Support-Rollen (Dropdown mit Suche), Regeln, Auto-Close, gesperrte Nutzer
- **Ticket-Typen:** jeder Typ klappt als eigener „Abriss“ auf; duplizieren, bearbeiten, löschen
- **Panels:** Editor mit Live-Vorschau wie in Discord, Bild, Farbe, Buttons oder Auswahlmenü
- **Tickets:** Filter nach Status, Suche nach Nummer oder Nutzer-ID, Seiten, Ticket direkt schließen

## Update einer laufenden Installation
Ersetze die Ordner `src` und `public` durch die neuen. Deine `.env` und der Ordner `data` bleiben unverändert,
die Datenbank erweitert sich beim Start automatisch (bestehende Tickets, Typen und Panels bleiben erhalten).
Danach den Bot neu starten.

## Einrichtung

### 1. Discord-Anwendung
1. <https://discord.com/developers/applications> → **New Application**
2. **Bot** → Token kopieren (`DISCORD_TOKEN`).
   Unter *Privileged Gateway Intents* **Message Content Intent** aktivieren (für den Text in Transcripts).
3. **OAuth2** → `Client ID` und `Client Secret` kopieren.
4. **OAuth2 → Redirects** → hinzufügen: `BASE_URL` + `/callback`, z. B. `http://localhost:3000/callback`

### 2. Starten
```bash
npm install
cp .env.example .env     # und ausfüllen
npm start
```
Danach `http://localhost:3000` öffnen (Startseite) und über **Dashboard** mit Discord anmelden,
Server wählen („Bot einladen“, falls der Bot noch nicht drauf ist).

### 3. Im Dashboard
1. **Allgemein:** Log-Kanal und Support-Rollen setzen
2. **Ticket-Typen:** mindestens einen Typ anlegen (z. B. „Support“)
3. **Panels:** Kanal wählen → **Panel senden**

## Online hosten
Die Website braucht Node.js, weil Bot und Dashboard im selben Programm laufen. Normales Webspace-Hosting (nur PHP/HTML) reicht dafür nicht.
Geeignet sind ein VPS oder Node-Hoster (z. B. Hetzner, Railway, Render, Pterodactyl-Panel mit Node-Egg).
- Auf einem Server mit Node ≥ 22.13 per `npm start` (am besten mit `pm2` oder systemd).
- `BASE_URL` auf deine öffentliche **https**-Adresse setzen und dieselbe URL + `/callback` im Developer Portal eintragen.
- Hinter nginx/Cloudflare: `TRUST_PROXY=true` setzen.
- Die Daten liegen in `data/tickets.db` – diesen Ordner sichern.
- Die Sessions liegen im Arbeitsspeicher: nach einem Neustart muss man sich im Dashboard neu anmelden.

## Bot-Rechte
Der Einladungslink aus dem Dashboard fordert: Kanäle verwalten, Rollen verwalten, Kanäle sehen, Nachrichten senden, Links einbetten, Dateien anhängen, Nachrichtenverlauf lesen.
Die Bot-Rolle muss **über** den Support-Rollen stehen oder zumindest die Kategorie sehen können.

## Platzhalter
| Wo | Platzhalter |
|---|---|
| Kanal-Name | `{number}` `{user}` `{type}` |
| Willkommensnachricht | `{user}` `{username}` `{type}` `{number}` |
