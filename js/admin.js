/* ==========================================================
   Mavo City – Admin-Bereich
   - Inhalte bearbeiten (News, Events, Wiki, Team …) ohne Code
   - Forum-Meldungen, Umfragen, Quiz-Ergebnisse
   Mit Supabase: Speichern direkt in die Datenbank (Tabelle site_content).
   Ohne Supabase: Bearbeiten möglich, Ergebnis als Code für js/data.js kopieren.
   ========================================================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  window.escapeHtml = esc;
  window.t = (s) => s;

  let toastTimer;
  window.showToast = (msg) => {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 3000);
  };

  /* ==========================================================
     Beschreibung aller bearbeitbaren Bereiche
     Feldtypen: text, textarea, md, number, select, check, list,
                datetime, image, changes, correct
     ========================================================== */
  const SECTIONS = {
    news: {
      label: "News", icon: "megaphone", varName: "NEWS", hint: "Erscheinen auf der Startseite. Neueste oben.",
      title: (i) => `${i.date || ""} – ${i.title || "Neue News"}`,
      blank: () => ({ date: new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }), title: "", text: "" }),
      fields: [
        { k: "date", label: "Datum", type: "text", help: "z. B. 08.11.2026" },
        { k: "title", label: "Titel", type: "text" },
        { k: "text", label: "Text", type: "textarea", wide: true },
      ],
    },
    events: {
      label: "Events", icon: "calendar", varName: "EVENTS", hint: "Werden automatisch nach Datum sortiert. Zeiten in deutscher Zeit.",
      title: (i) => `${(i.date || "").replace("T", " ")} – ${i.title || "Neues Event"}`,
      blank: () => ({ title: "", date: "", location: "", type: "", desc: "" }),
      fields: [
        { k: "title", label: "Titel", type: "text" },
        { k: "date", label: "Datum & Uhrzeit", type: "datetime" },
        { k: "location", label: "Ort", type: "text" },
        { k: "type", label: "Art", type: "text", help: "z. B. Treffen, Rennen, Fraktion" },
        { k: "desc", label: "Beschreibung", type: "textarea", wide: true },
      ],
    },
    changelog: {
      label: "Updates", icon: "refresh", varName: "CHANGELOG", hint: "Neueste Version oben.",
      title: (i) => `v${i.version || "?"} – ${i.title || ""}`,
      blank: () => ({ version: "", date: new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }), title: "", items: [] }),
      fields: [
        { k: "version", label: "Version", type: "text", help: "z. B. 1.2.0" },
        { k: "date", label: "Datum", type: "text" },
        { k: "title", label: "Titel", type: "text", wide: true },
        { k: "items", label: "Änderungen", type: "changes", wide: true, help: "Eine pro Zeile: neu: Text  ·  fix: Text  ·  änderung: Text" },
      ],
    },
    wiki: {
      label: "Wiki", icon: "book", varName: "WIKI", hint: "Artikel mit Formatierung (# Überschrift, **fett**, - Liste, | Tabelle |).",
      title: (i) => i.title || "Neuer Artikel",
      blank: () => ({ id: "", icon: "file", title: "", category: "", content: "# Titel\n\nText…" }),
      fields: [
        { k: "title", label: "Titel", type: "text" },
        { k: "id", label: "Kurzname für den Link", type: "text", help: "nur a-z, 0-9, - (z. B. strafkatalog)" },
        { k: "category", label: "Kategorie", type: "text" },
        { k: "icon", label: "Symbol", type: "icon" },
        { k: "content", label: "Inhalt", type: "md", wide: true },
      ],
    },
    team: {
      label: "Team", icon: "users", varName: "TEAM",
      title: (i) => `${i.name || "Neues Mitglied"} – ${i.role || ""}`,
      blank: () => ({ name: "", role: "", avatar: "" }),
      fields: [
        { k: "name", label: "Name", type: "text" },
        { k: "role", label: "Rolle", type: "text" },
        { k: "avatar", label: "Profilbild (optional)", type: "image", wide: true },
      ],
    },
    factions: {
      label: "Fraktionen", icon: "shield", varName: "FACTIONS",
      title: (i) => i.name || "Neue Fraktion",
      blank: () => ({ name: "", short: "", type: "zivil", icon: "building", status: "offen", desc: "", requirements: [] }),
      fields: [
        { k: "name", label: "Name", type: "text" },
        { k: "short", label: "Kürzel", type: "text" },
        { k: "type", label: "Art", type: "select", options: [["staat", "Staat"], ["zivil", "Zivil"], ["crime", "Crime"]] },
        { k: "status", label: "Bewerbungen", type: "select", options: [["offen", "offen"], ["geschlossen", "geschlossen"]] },
        { k: "icon", label: "Symbol", type: "icon" },
        { k: "desc", label: "Beschreibung", type: "textarea", wide: true },
        { k: "requirements", label: "Voraussetzungen", type: "list", wide: true, help: "Eine pro Zeile" },
      ],
    },
    gallery: {
      label: "Galerie", icon: "image", varName: "GALLERY",
      title: (i) => `${i.type === "video" ? "🎬" : "📷"} ${i.title || "Neuer Eintrag"}`,
      blank: () => ({ type: "image", src: "", youtubeId: "", title: "" }),
      fields: [
        { k: "title", label: "Titel", type: "text" },
        { k: "type", label: "Art", type: "select", options: [["image", "Bild"], ["video", "YouTube-Video"]] },
        { k: "src", label: "Bild", type: "image", wide: true, help: "Nur bei Art = Bild" },
        { k: "youtubeId", label: "YouTube-ID", type: "text", help: "Nur bei Video: Teil nach watch?v=" },
      ],
    },
    hero: {
      label: "Startseiten-Bilder", icon: "camera", varName: "HERO_IMAGES", hint: "Hintergrundbilder oben auf der Startseite (wechseln automatisch).",
      title: (i) => i.src ? i.src.split("/").pop() : "Neues Bild",
      blank: () => ({ src: "" }),
      fields: [{ k: "src", label: "Bild", type: "image", wide: true }],
      toCode: (items) => items.map((i) => i.src),
    },
    map: {
      label: "Stadtkarte", icon: "map", varName: "MAP_LOCATIONS",
      title: (i) => i.name || "Neuer Ort",
      blank: () => ({ name: "", type: "zivil", x: 50, y: 50, desc: "" }),
      fields: [
        { k: "name", label: "Name", type: "text" },
        { k: "type", label: "Art", type: "select", options: [["staat", "Staat"], ["zivil", "Zivil"], ["job", "Jobs"], ["freizeit", "Freizeit"], ["crime", "Crime"]] },
        { k: "x", label: "Position X (%)", type: "number" },
        { k: "y", label: "Position Y (%)", type: "number" },
        { k: "_pick", label: "", type: "mappick" },
        { k: "desc", label: "Beschreibung", type: "textarea", wide: true },
      ],
    },
    streamers: {
      label: "Streamer", icon: "twitch", varName: "STREAMERS",
      title: (i) => i.name || "Neuer Streamer",
      blank: () => ({ name: "", twitch: "", desc: "" }),
      fields: [
        { k: "name", label: "Name", type: "text" },
        { k: "twitch", label: "Twitch-Kanal", type: "text", help: "aus twitch.tv/KANAL" },
        { k: "desc", label: "Beschreibung", type: "textarea", wide: true },
      ],
    },
    quiz: {
      label: "Regel-Quiz", icon: "clipboard", varName: "QUIZ",
      title: (i) => i.q || "Neue Frage",
      blank: () => ({ q: "", answers: ["", "", ""], correct: 0 }),
      fields: [
        { k: "q", label: "Frage", type: "text", wide: true },
        { k: "answers", label: "Antworten", type: "list", wide: true, help: "Eine pro Zeile" },
        { k: "correct", label: "Richtige Antwort", type: "correct", help: "Nummer der richtigen Zeile (1 = erste)" },
      ],
    },
    forum: {
      label: "Forum-Kategorien", icon: "chat", varName: "FORUM_CATEGORIES",
      hint: "Foren und Bereiche des Forums. Reihenfolge hier = Reihenfolge im Forum. Den Kurznamen (ID) nach dem Anlegen nicht mehr ändern – sonst verschwinden die Themen darin.",
      title: (i) => `${i.group ? i.group + " › " : ""}${i.title || "Neue Kategorie"}${i.adminOnly ? " (nur Admins)" : ""}${i.statuses ? " · Status" : ""}`,
      blank: () => ({ id: "", group: "Allgemein", icon: "chat", title: "", desc: "", adminOnly: false, statuses: false, template: "" }),
      fields: [
        { k: "title", label: "Name", type: "text" },
        { k: "group", label: "Bereich", type: "text", help: "z. B. „Support & Beschwerden“ – gleicher Text = gleicher Bereich" },
        { k: "id", label: "Kurzname (ID)", type: "text", help: "nur a-z, 0-9 und - (z. B. marktplatz)" },
        { k: "icon", label: "Symbol", type: "icon" },
        { k: "desc", label: "Beschreibung", type: "text", wide: true },
        { k: "adminOnly", label: "Nur Admins dürfen hier Themen erstellen", type: "check" },
        { k: "statuses", label: "Status-Präfixe (Offen, In Bearbeitung, Angenommen …)", type: "check" },
        { k: "template", label: "Vorlage für neue Themen (optional)", type: "md", wide: true },
      ],
    },
    packages: {
      label: "Spenden-Pakete", icon: "heart", varName: "DONATION_PACKAGES", hint: "Bitte nur kosmetische Vorteile – kein Pay2Win.",
      title: (i) => `${i.name || "Neues Paket"} – ${i.price || ""}`,
      blank: () => ({ name: "", price: "", icon: "heart", highlight: false, perks: [] }),
      fields: [
        { k: "name", label: "Name", type: "text" },
        { k: "price", label: "Preis", type: "text", help: "z. B. 4,99 €" },
        { k: "icon", label: "Symbol", type: "icon" },
        { k: "highlight", label: "Als „Beliebt“ hervorheben", type: "check" },
        { k: "perks", label: "Vorteile", type: "list", wide: true, help: "Einer pro Zeile" },
      ],
    },
  };

  const ICON_CHOICES = [
    ["shield", "Schild (Polizei)"], ["medkit", "Koffer (Rettungsdienst)"], ["scale", "Waage (Justiz)"],
    ["wrench", "Schraubenschlüssel"], ["mask", "Sonnenbrille (Crime)"], ["briefcase", "Aktenkoffer"],
    ["car", "Auto"], ["building", "Gebäude"], ["store", "Laden"], ["star", "Stern"], ["heart", "Herz"],
    ["trophy", "Pokal"], ["gift", "Geschenk"], ["flag", "Flagge"], ["keyboard", "Tastatur"], ["book", "Buch"],
    ["file", "Dokument"], ["chat", "Sprechblase"], ["megaphone", "Megafon"], ["lightbulb", "Glühbirne"],
    ["users", "Personen"], ["calendar", "Kalender"], ["map", "Karte"], ["pin", "Ort"], ["gamepad", "Controller"],
    ["camera", "Kamera"], ["video", "Video"], ["sun", "Sonne"], ["lock", "Schloss"], ["info", "Info"],
  ];

  /* ==========================================================
     Zustand
     ========================================================== */
  let sb = null;
  let canSave = false;            // Supabase + Admin
  let section = "news";
  const working = {};             // bearbeitete Kopien je Bereich
  const dirty = new Set();
  let openIndex = null;           // aufgeklappter Eintrag

  const clone = (x) => JSON.parse(JSON.stringify(x ?? []));
  const items = () => (working[section] ||= clone(CONTENT[section]));

  /* ==========================================================
     Anmeldung & Hinweise
     ========================================================== */
  function renderUser() {
    const u = MavoAuth.user;
    $("#adminUser").innerHTML = `<a class="icon-btn" href="index.html" title="Zur Website" aria-label="Zur Website">${icon("home")}</a>` + (!MavoAuth.enabled ? "" : u
      ? `<span class="admin-me">${u.avatar ? `<img class="avatar avatar--sm" src="${esc(u.avatar)}" alt="">` : ""}<span>${esc(u.name)}</span></span>
         <button class="btn btn--ghost btn--sm" id="logoutBtn">Abmelden</button>`
      : `<button class="btn btn--discord btn--sm" id="loginBtn">${icon("discord")} Mit Discord anmelden</button>`);
    $("#loginBtn")?.addEventListener("click", () => MavoAuth.login().catch((e) => showToast(e.message)));
    $("#logoutBtn")?.addEventListener("click", () => MavoAuth.logout().then(init));
  }

  function renderNotice() {
    const u = MavoAuth.user;
    let html = "";
    if (!MavoAuth.enabled) {
      html = `<div class="notice"><strong>Demo-Modus – Supabase ist noch nicht eingerichtet.</strong><br>
        Du kannst alle Inhalte hier bearbeiten. Statt „Speichern“ bekommst du fertigen Code, den du in
        <code>js/data.js</code> einfügst. Mit Supabase (siehe <code>ANLEITUNG.md</code>) wird direkt gespeichert –
        dann gibt es auch Meldungen, Umfragen und Quiz-Ergebnisse.</div>`;
    } else if (!u) {
      html = `<div class="notice"><strong>Bitte melde dich mit Discord an.</strong><br>Nur eingetragene Admins können Inhalte ändern.</div>`;
    } else if (!u.isAdmin) {
      html = `<div class="notice notice--warn"><strong>Du bist kein Admin.</strong><br>
        Damit du hier speichern kannst, führe im Supabase SQL-Editor aus:
        <pre>insert into public.forum_admins (user_id) values ('${esc(u.id)}');</pre>
        Danach diese Seite neu laden. Weitere Admins kannst du danach unter <em>Nutzer</em> per Klick ernennen.</div>`;
    }
    $("#adminNotice").innerHTML = html;
  }

  /* ==========================================================
     Inhalte bearbeiten
     ========================================================== */
  function fieldHtml(f, item, idx) {
    const id = `f-${idx}-${f.k}`;
    const v = item[f.k];
    const base = `data-i="${idx}" data-k="${f.k}" id="${id}"`;
    let input;
    switch (f.type) {
      case "textarea": input = `<textarea ${base}>${esc(v)}</textarea>`; break;
      case "md":
        input = `<div class="md-editor">${mdToolbar()}<textarea class="big" ${base}>${esc(v)}</textarea></div>
                 <button type="button" class="btn btn--ghost btn--sm" data-mdprev="${idx}">${icon("eye")} Vorschau anzeigen</button>
                 <div class="md-preview md" id="prev-${idx}" hidden></div>`;
        break;
      case "number": input = `<input type="number" step="0.5" min="0" max="100" ${base} value="${esc(v)}">`; break;
      case "datetime": input = `<input type="datetime-local" ${base} value="${esc(v)}">`; break;
      case "select":
        input = `<select ${base}>${f.options.map(([val, lab]) => `<option value="${esc(val)}" ${val === v ? "selected" : ""}>${esc(lab)}</option>`).join("")}</select>`;
        break;
      case "icon": {
        const known = ICON_CHOICES.some(([k]) => k === v);
        input = `<select ${base}>${ICON_CHOICES.map(([k, lab]) => `<option value="${k}" ${k === v ? "selected" : ""}>${esc(lab)}</option>`).join("")}
                 ${!known && v ? `<option value="${esc(v)}" selected>${esc(v)} (eigenes)</option>` : ""}</select>`;
        break;
      }
      case "check":
        return `<label class="field field--check"><input type="checkbox" ${base} ${v ? "checked" : ""}> ${esc(f.label)}</label>`;
      case "list": input = `<textarea ${base} data-type="list">${esc((v || []).join("\n"))}</textarea>`; break;
      case "changes":
        input = `<textarea ${base} data-type="changes">${esc((v || []).map((c) => `${c.type}: ${c.text}`).join("\n"))}</textarea>`;
        break;
      case "correct": input = `<input type="number" min="1" ${base} data-type="correct" value="${(Number(v) || 0) + 1}">`; break;
      case "image":
        input = `<div class="field-row">
            <input type="text" ${base} value="${esc(v)}" placeholder="assets/bild.jpg oder https://…">
            ${canSave ? `<label class="btn btn--ghost btn--sm">${icon("image")} Hochladen<input type="file" accept="image/*" hidden data-upload="${idx}" data-uk="${f.k}"></label>` : ""}
          </div>
          ${v ? `<img class="img-preview" src="${esc(v)}" alt="">` : ""}`;
        break;
      case "mappick":
        return `<div class="field"><span>&nbsp;</span><button type="button" class="btn btn--ghost btn--sm" data-pick="${idx}">${icon("pin")} Auf Karte wählen</button></div>`;
      default: input = `<input type="text" ${base} value="${esc(v)}">`;
    }
    return `<label class="field ${f.wide ? "field--wide" : ""}" for="${id}"><span>${esc(f.label)}</span>${input}${f.help ? `<small>${esc(f.help)}</small>` : ""}</label>`;
  }

  function renderEditor() {
    const s = SECTIONS[section];
    const list = items();
    $("#editor").innerHTML = `
      <div class="editor-head">
        <div><span class="eyebrow">Inhalte</span><h2>${s.label}</h2>${s.hint ? `<p>${esc(s.hint)}</p>` : ""}</div>
        <button class="btn btn--primary btn--sm" data-act="add">${icon("star")} Neuer Eintrag</button>
      </div>
      <div class="items">
        ${list.map((item, idx) => `
          <details class="item" ${openIndex === idx ? "open" : ""} data-item="${idx}">
            <summary>
              <span class="item__title">${esc(s.title(item))}</span>
              <span class="item__tools">
                <button type="button" data-act="up" data-idx="${idx}" title="Nach oben" aria-label="Nach oben">${icon("chevron-down", "flip")}</button>
                <button type="button" data-act="down" data-idx="${idx}" title="Nach unten" aria-label="Nach unten">${icon("chevron-down")}</button>
                <button type="button" data-act="del" data-idx="${idx}" title="Löschen" aria-label="Löschen">${icon("x")}</button>
              </span>
            </summary>
            <div class="item__body">${s.fields.map((f) => fieldHtml(f, item, idx)).join("")}</div>
          </details>`).join("") || `<div class="empty">Noch keine Einträge.</div>`}
      </div>
      <div class="save-bar">
        <span class="hint">${dirty.has(section) ? "● Ungespeicherte Änderungen" : `${icon("check-circle")} Alles gespeichert`}</span>
        <button class="btn btn--ghost btn--sm" data-act="reset">Auf Standard zurücksetzen</button>
        ${canSave
          ? `<button class="btn btn--primary" data-act="save" ${dirty.has(section) ? "" : "disabled"}>Speichern & veröffentlichen</button>`
          : `<button class="btn btn--primary" data-act="code">Code für data.js erzeugen</button>`}
      </div>
      <div id="codeOut"></div>`;
  }

  function markDirty() {
    dirty.add(section);
    const hint = $(".save-bar .hint");
    if (hint) hint.textContent = "● Ungespeicherte Änderungen";
    const btn = $('[data-act="save"]');
    if (btn) btn.disabled = false;
    renderNav();
  }

  // Eingaben direkt in die Arbeitskopie übernehmen
  $("#editor").addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.i === undefined) return;
    const item = items()[Number(el.dataset.i)];
    const k = el.dataset.k;
    const type = el.dataset.type;
    if (el.type === "checkbox") item[k] = el.checked;
    else if (el.type === "number" && type !== "correct") item[k] = el.value === "" ? 0 : Number(el.value);
    else if (type === "list") item[k] = el.value.split("\n").map((s) => s.trim()).filter(Boolean);
    else if (type === "changes") {
      item[k] = el.value.split("\n").map((line) => {
        const m = line.match(/^\s*(neu|fix|änderung|aenderung)\s*:\s*(.+)$/i);
        return m ? { type: m[1].toLowerCase().replace("aenderung", "änderung"), text: m[2].trim() }
          : line.trim() ? { type: "änderung", text: line.trim() } : null;
      }).filter(Boolean);
    } else if (type === "correct") item[k] = Math.max(0, (parseInt(el.value, 10) || 1) - 1);
    else item[k] = el.value;

    // Titel in der Zusammenfassung aktualisieren
    const title = $(`[data-item="${el.dataset.i}"] .item__title`);
    if (title) title.textContent = SECTIONS[section].title(item);
    markDirty();
  });

  $("#editor").addEventListener("toggle", (e) => {
    if (e.target.matches?.(".item") && e.target.open) openIndex = Number(e.target.dataset.item);
  }, true);

  $("#editor").addEventListener("click", async (e) => {
    const prevBtn = e.target.closest("[data-mdprev]");
    if (prevBtn) {
      const idx = prevBtn.dataset.mdprev;
      const box = $(`#prev-${idx}`);
      box.hidden = !box.hidden;
      const it = items()[idx];
      box.innerHTML = renderMarkdown(it.content ?? it.template ?? "");
      prevBtn.textContent = box.hidden ? "Vorschau anzeigen" : "Vorschau ausblenden";
      return;
    }
    const pick = e.target.closest("[data-pick]");
    if (pick) return openMapPicker(Number(pick.dataset.pick));

    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    const list = items();
    const idx = Number(btn.dataset.idx);
    if (["up", "down", "del"].includes(act)) e.preventDefault(); // nicht auf-/zuklappen

    if (act === "add") { list.unshift(SECTIONS[section].blank()); openIndex = 0; markDirty(); renderEditor(); }
    if (act === "up" && idx > 0) { [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]; openIndex = null; markDirty(); renderEditor(); }
    if (act === "down" && idx < list.length - 1) { [list[idx + 1], list[idx]] = [list[idx], list[idx + 1]]; openIndex = null; markDirty(); renderEditor(); }
    if (act === "del" && confirm("Diesen Eintrag löschen?")) { list.splice(idx, 1); openIndex = null; markDirty(); renderEditor(); }
    if (act === "save") save();
    if (act === "reset") resetSection();
    if (act === "code") showCode();
  });

  // Bild-Upload in Supabase Storage (Bucket "gallery")
  $("#editor").addEventListener("change", async (e) => {
    const input = e.target.closest("[data-upload]");
    if (!input || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) return showToast("Bild ist größer als 5 MB.");
    const path = `${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`;
    showToast("Lade hoch…");
    const { error } = await sb.storage.from("gallery").upload(path, file, { cacheControl: "31536000", upsert: false });
    if (error) return showToast("Upload fehlgeschlagen: " + error.message);
    const url = sb.storage.from("gallery").getPublicUrl(path).data.publicUrl;
    items()[Number(input.dataset.upload)][input.dataset.uk] = url;
    markDirty();
    renderEditor();
    showToast("Hochgeladen ✓");
  });

  function validate(list) {
    if (section === "wiki") {
      const ids = new Set();
      for (const a of list) {
        a.id = (a.id || a.title || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
          .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!a.id) return "Jeder Wiki-Artikel braucht einen Titel.";
        if (ids.has(a.id)) return `Der Kurzname „${a.id}“ kommt doppelt vor.`;
        ids.add(a.id);
      }
    }
    if (section === "forum") {
      const ids = new Set();
      for (const c of list) {
        c.id = (c.id || c.title || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
          .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
        if (!c.id || !c.title) return "Jede Kategorie braucht einen Namen.";
        if (ids.has(c.id)) return `Der Kurzname „${c.id}“ kommt doppelt vor.`;
        ids.add(c.id);
      }
      if (!list.length) return "Mindestens eine Kategorie ist nötig.";
    }
    if (section === "quiz") {
      for (const q of list) if (!(q.answers?.length >= 2) || q.correct >= q.answers.length) return `Frage „${q.q}“: mind. 2 Antworten und eine gültige richtige Antwort nötig.`;
    }
    return null;
  }

  async function save() {
    const list = items();
    const problem = validate(list);
    if (problem) return showToast(problem);
    const { error } = await sb.from("site_content").upsert({ key: section, data: list, updated_at: new Date().toISOString() });
    if (error) return showToast("Fehler: " + error.message);
    CONTENT[section] = clone(list);
    dirty.delete(section);
    renderNav(); renderEditor();
    showToast("Gespeichert & veröffentlicht ✓");
  }

  async function resetSection() {
    if (!confirm("Alle Änderungen in diesem Bereich verwerfen und die Standard-Inhalte aus js/data.js verwenden?")) return;
    if (canSave) {
      const { error } = await sb.from("site_content").delete().eq("key", section);
      if (error) return showToast("Fehler: " + error.message);
    }
    CONTENT[section] = clone(CONTENT_DEFAULTS[section]);
    working[section] = clone(CONTENT_DEFAULTS[section]);
    dirty.delete(section);
    renderNav(); renderEditor();
    showToast("Zurückgesetzt.");
  }

  function showCode() {
    const s = SECTIONS[section];
    const list = items();
    const problem = validate(list);
    if (problem) return showToast(problem);
    const data = s.toCode ? s.toCode(list) : list;
    const code = `const ${s.varName} = ${JSON.stringify(data, null, 2)};`;
    $("#codeOut").innerHTML = `
      <div class="notice">Ersetze in <code>js/data.js</code> den Block <code>const ${s.varName} = […];</code> durch diesen Code:
        <textarea class="code-out" readonly>${esc(code)}</textarea>
        <button class="btn btn--primary btn--sm" id="copyCode">In Zwischenablage kopieren</button></div>`;
    $("#copyCode").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(code); showToast("Kopiert ✓"); }
      catch { $(".code-out").select(); showToast("Bitte manuell kopieren (Strg+C)."); }
    });
  }


  window.addEventListener("beforeunload", (e) => { if (dirty.size) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Karte: Position wählen ---------- */
  function openMapPicker(idx) {
    const box = $("#mapPicker");
    const item = items()[idx];
    const canvas = $("#mapPickerCanvas");
    canvas.innerHTML = `<img src="${esc(CONFIG.mapImage || "assets/map.svg")}" alt=""><span class="map-picker__dot" style="left:${item.x}%;top:${item.y}%"></span>`;
    box.hidden = false;
    canvas.onclick = (e) => {
      const r = canvas.getBoundingClientRect();
      item.x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
      item.y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
      box.hidden = true;
      markDirty(); openIndex = idx; renderEditor();
    };
  }
  $("#mapPicker .lightbox__close").addEventListener("click", () => ($("#mapPicker").hidden = true));

  /* ==========================================================
     Meldungen
     ========================================================== */
  async function loadReports() {
    const view = $("#reportsView");
    if (!canSave) { view.innerHTML = `<div class="empty">Benötigt Supabase und Admin-Rechte.</div>`; return; }
    const { data, error } = await sb.from("forum_reports")
      .select("id, reason, resolved, created_at, post:forum_posts(id, body, author_name, thread_id)")
      .order("resolved").order("created_at", { ascending: false }).limit(200);
    if (error) { view.innerHTML = `<div class="empty">Fehler: ${esc(error.message)}</div>`; return; }
    const open = data.filter((r) => !r.resolved).length;
    openCount = open; renderNav();
    view.innerHTML = data.length ? `
      <div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Datum</th><th>Grund</th><th>Beitrag</th><th></th></tr></thead>
        <tbody>${data.map((r) => `
          <tr class="${r.resolved ? "is-done" : ""}">
            <td>${new Date(r.created_at).toLocaleString("de-DE")}</td>
            <td class="quote">${esc(r.reason)}</td>
            <td class="quote">${r.post ? `<strong>${esc(r.post.author_name)}:</strong> ${esc(r.post.body.slice(0, 300))}` : "<em>Beitrag gelöscht</em>"}</td>
            <td><div class="btn-row">
              ${r.post ? `<a class="btn btn--ghost btn--sm" href="index.html#forum/thread/${esc(r.post.thread_id)}" target="_blank">Ansehen</a>` : ""}
              ${!r.resolved ? `<button class="btn btn--ghost btn--sm" data-resolve="${r.id}">Erledigt</button>` : ""}
              ${r.post ? `<button class="btn btn--ghost btn--sm btn--danger" data-delpost="${r.post.id}">Beitrag löschen</button>` : ""}
            </div></td>
          </tr>`).join("")}
        </tbody></table></div>` : `<div class="empty">Keine Meldungen 🎉</div>`;
  }

  $("#reportsView").addEventListener("click", async (e) => {
    const res = e.target.closest("[data-resolve]");
    const del = e.target.closest("[data-delpost]");
    if (res) {
      const { error } = await sb.from("forum_reports").update({ resolved: true }).eq("id", res.dataset.resolve);
      if (error) return showToast(error.message);
    }
    if (del) {
      if (!confirm("Beitrag wirklich löschen?")) return;
      const { error } = await sb.from("forum_posts").delete().eq("id", del.dataset.delpost);
      if (error) return showToast(error.message);
      showToast("Beitrag gelöscht.");
    }
    if (res || del) loadReports();
  });

  /* ==========================================================
     Umfragen
     ========================================================== */
  async function loadPolls() {
    const view = $("#pollsView");
    if (!canSave) { view.innerHTML = `<div class="empty">Benötigt Supabase und Admin-Rechte.</div>`; return; }
    const { data, error } = await sb.from("polls").select("*").order("created_at", { ascending: false });
    if (error) { view.innerHTML = `<div class="empty">Fehler: ${esc(error.message)}</div>`; return; }
    const results = await Promise.all(data.map((p) => sb.rpc("poll_results", { p_poll: p.id })));

    view.innerHTML = `
      <form class="form" id="pollForm">
        <h3>Neue Umfrage</h3>
        <input name="question" placeholder="Frage" required minlength="3" maxlength="200">
        <textarea name="options" placeholder="Antworten – eine pro Zeile (2 bis 10)" required></textarea>
        <label class="field"><span>Endet am (optional)</span><input type="datetime-local" name="ends"></label>
        <div class="form__actions"><button class="btn btn--primary btn--sm">Umfrage starten</button></div>
      </form>
      <h3 style="margin-top:32px">Alle Umfragen</h3>
      <div class="poll-admin">${data.map((p, i) => {
        const counts = p.options.map(() => 0);
        (results[i].data || []).forEach((r) => (counts[r.option_index] = Number(r.votes)));
        const total = counts.reduce((a, b) => a + b, 0);
        return `
          <div class="card">
            <div class="poll-admin__head">
              <h3>${esc(p.question)}</h3>
              <div class="btn-row">
                <span class="tag ${p.active ? "tag--ok" : ""}">${p.active ? "aktiv" : "beendet"}</span>
                <button class="btn btn--ghost btn--sm" data-toggle="${p.id}" data-active="${p.active}">${p.active ? "Beenden" : "Aktivieren"}</button>
                <button class="btn btn--ghost btn--sm btn--danger" data-delpoll="${p.id}">Löschen</button>
              </div>
            </div>
            <div class="poll__options" style="margin-top:12px">${p.options.map((o, j) => {
              const pct = total ? Math.round((counts[j] / total) * 100) : 0;
              return `<div class="poll__result"><div class="poll__bar" style="width:${pct}%"></div><span>${esc(o)}</span><strong>${counts[j]} (${pct} %)</strong></div>`;
            }).join("")}</div>
            <p class="poll__meta" style="margin-top:8px">${total} Stimmen${p.ends_at ? ` · endet ${new Date(p.ends_at).toLocaleString("de-DE")}` : ""}</p>
          </div>`;
      }).join("") || `<div class="empty">Noch keine Umfragen.</div>`}</div>`;

    $("#pollForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      const options = f.options.value.split("\n").map((s) => s.trim()).filter(Boolean);
      if (options.length < 2 || options.length > 10) return showToast("Bitte 2 bis 10 Antworten angeben.");
      const { error } = await sb.from("polls").insert({
        question: f.question.value.trim(), options, active: true,
        ends_at: f.ends.value ? new Date(f.ends.value).toISOString() : null,
      });
      if (error) return showToast(error.message);
      showToast("Umfrage gestartet ✓");
      loadPolls();
    });
  }

  $("#pollsView").addEventListener("click", async (e) => {
    const tog = e.target.closest("[data-toggle]");
    const del = e.target.closest("[data-delpoll]");
    if (tog) {
      const { error } = await sb.from("polls").update({ active: tog.dataset.active !== "true" }).eq("id", tog.dataset.toggle);
      if (error) return showToast(error.message);
    }
    if (del) {
      if (!confirm("Umfrage inkl. aller Stimmen löschen?")) return;
      const { error } = await sb.from("polls").delete().eq("id", del.dataset.delpoll);
      if (error) return showToast(error.message);
    }
    if (tog || del) loadPolls();
  });

  /* ==========================================================
     Quiz-Ergebnisse
     ========================================================== */
  async function loadQuiz() {
    const view = $("#quizView");
    if (!canSave) { view.innerHTML = `<div class="empty">Benötigt Supabase und Admin-Rechte.</div>`; return; }
    const { data, error } = await sb.from("quiz_results").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) { view.innerHTML = `<div class="empty">Fehler: ${esc(error.message)}</div>`; return; }
    view.innerHTML = `
      <input type="search" class="input" id="quizSearch" placeholder="Nach Discord-Name suchen…" style="max-width:320px;margin-bottom:16px">
      ${data.length ? `<div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Discord-Name</th><th>Ergebnis</th><th>Status</th><th>Datum</th><th></th></tr></thead>
        <tbody>${data.map((r) => `
          <tr data-name="${esc(r.user_name.toLowerCase())}">
            <td>${esc(r.user_name)}</td>
            <td>${r.score} / ${r.total}</td>
            <td><span class="tag ${r.passed ? "tag--ok" : "tag--no"}">${r.passed ? "bestanden" : "nicht bestanden"}</span></td>
            <td>${new Date(r.created_at).toLocaleString("de-DE")}</td>
            <td><button class="btn btn--ghost btn--sm btn--danger" data-delquiz="${r.id}">Löschen</button></td>
          </tr>`).join("")}</tbody></table></div>` : `<div class="empty">Noch keine Ergebnisse.</div>`}`;
    $("#quizSearch").addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      $$("#quizView tbody tr").forEach((tr) => (tr.hidden = !tr.dataset.name.includes(q)));
    });
  }

  $("#quizView").addEventListener("click", async (e) => {
    const del = e.target.closest("[data-delquiz]");
    if (!del || !confirm("Ergebnis löschen?")) return;
    const { error } = await sb.from("quiz_results").delete().eq("id", del.dataset.delquiz);
    if (error) return showToast(error.message);
    loadQuiz();
  });

  /* ==========================================================
     Übersicht (Dashboard)
     ========================================================== */
  async function loadDashboard() {
    const view = $("#dashView");
    const u = MavoAuth.user;
    const hour = new Date().getHours();
    const hello = hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";
    view.innerHTML = `
      <div class="dash-hello">
        <div>
          <span class="eyebrow">Admin-Bereich</span>
          <h1>${hello}${u ? `, ${esc(u.name)}` : ""}.</h1>
          <p class="muted">${canSave ? "Hier hast du alles im Blick." : "Demo-Modus: Inhalte bearbeiten und als Code exportieren."}</p>
        </div>
        <a class="btn btn--ghost btn--sm" href="index.html" target="_blank">${icon("external")} Website ansehen</a>
      </div>
      <div class="dash-actions">
        ${[
          ["content:news", "megaphone", "News schreiben", "add"],
          ["content:events", "calendar", "Event anlegen", "add"],
          ["polls", "chart", "Umfrage starten", ""],
          ["content:wiki", "book", "Wiki-Artikel", "add"],
          ["content:gallery", "image", "Bild hochladen", "add"],
        ].map(([nav, ic, label, add]) => `
          <button class="dash-action" data-nav="${nav}" ${add ? 'data-add="1"' : ""}>${icon(ic)}<span>${label}</span></button>`).join("")}
      </div>
      <div class="dash-stats" id="dashStats">${canSave ? '<div class="loader">…</div>' : ""}</div>
      ${canSave ? `
      <div class="dash-grid">
        <section class="panel-card">
          <div class="panel-card__head"><h3>Neueste Forenbeiträge</h3><a href="index.html#forum" target="_blank">Zum Forum ${icon("arrow-right")}</a></div>
          <div id="dashPosts"><div class="loader">…</div></div>
        </section>
        <section class="panel-card">
          <div class="panel-card__head"><h3>Offene Meldungen</h3><button class="link-btn" data-nav="reports">Alle ${icon("arrow-right")}</button></div>
          <div id="dashReports"><div class="loader">…</div></div>
        </section>
      </div>` : ""}`;
    if (!canSave) return;

    // Kennzahlen
    const { data: s, error } = await sb.rpc("admin_stats");
    const stat = (ic, value, label, sub, nav) => `
      <${nav ? `button data-nav="${nav}"` : "div"} class="stat-card">
        <span class="stat-card__icon">${icon(ic)}</span>
        <strong>${value ?? "–"}</strong><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}
      </${nav ? "button" : "div"}>`;
    $("#dashStats").innerHTML = error
      ? `<div class="notice notice--warn"><strong>Statistik nicht verfügbar.</strong> Bitte <code>supabase/update-3-forum-admin.sql</code> im SQL-Editor ausführen.</div>`
      : [
          stat("users", s.users, "Mitglieder", `+${s.users_7d} diese Woche`, "users"),
          stat("chat", s.posts, "Beiträge", `+${s.posts_7d} diese Woche`),
          stat("file", s.threads, "Themen"),
          stat("flag", s.reports_open, "Offene Meldungen", s.reports_open ? "Bitte prüfen" : "Alles erledigt", "reports"),
          stat("check-circle", s.quiz_passed, "Quiz bestanden", `+${s.quiz_7d} diese Woche`, "quiz"),
          stat("chart", s.polls_active, "Aktive Umfragen", "", "polls"),
        ].join("");

    // Neueste Beiträge
    const { data: posts } = await sb.from("forum_posts")
      .select("id, body, author_name, author_avatar, created_at, thread_id, forum_threads(title)")
      .order("created_at", { ascending: false }).limit(8);
    $("#dashPosts").innerHTML = (posts || []).length ? posts.map((p) => `
      <a class="feed-item" href="index.html#forum/thread/${esc(p.thread_id)}/last" target="_blank">
        ${p.author_avatar ? `<img class="avatar avatar--sm" src="${esc(p.author_avatar)}" alt="">` : `<span class="avatar avatar--sm avatar--letter">${esc((p.author_name || "?")[0])}</span>`}
        <span><strong>${esc(p.author_name)}</strong>${p.forum_threads?.title ? ` in „${esc(p.forum_threads.title)}“` : ""}
          <small>${esc(p.body.replace(/[#>*_`\[\]!()]/g, "").slice(0, 90))}</small></span>
        <time>${new Date(p.created_at).toLocaleDateString("de-DE")}</time>
      </a>`).join("") : `<p class="muted">Noch keine Beiträge.</p>`;

    // Offene Meldungen (Kurzfassung)
    const { data: reps } = await sb.from("forum_reports")
      .select("id, reason, created_at, post:forum_posts(author_name, thread_id)")
      .eq("resolved", false).order("created_at", { ascending: false }).limit(5);
    $("#dashReports").innerHTML = (reps || []).length ? reps.map((r) => `
      <div class="feed-item">
        <span class="feed-item__icon">${icon("flag")}</span>
        <span><strong>${esc(r.post?.author_name || "Gelöschter Beitrag")}</strong><small>${esc(r.reason)}</small></span>
        <time>${new Date(r.created_at).toLocaleDateString("de-DE")}</time>
      </div>`).join("") : `<p class="muted">${icon("check-circle")} Keine offenen Meldungen.</p>`;
  }

  /* ==========================================================
     Nutzer verwalten
     ========================================================== */
  let userFilter = "";
  async function loadUsers() {
    const view = $("#usersView");
    if (!canSave) { view.innerHTML = `<div class="empty">Benötigt Supabase und Admin-Rechte.</div>`; return; }
    const [prof, stats] = await Promise.all([
      sb.from("forum_profiles").select("*").order("created_at", { ascending: false }).limit(1000),
      sb.from("forum_user_stats").select("user_id, post_count, last_post_at"),
    ]);
    if (prof.error) {
      view.innerHTML = `<div class="notice notice--warn"><strong>Nutzerverwaltung noch nicht aktiv.</strong><br>
        Bitte <code>supabase/update-3-forum-admin.sql</code> im Supabase SQL-Editor ausführen und die Seite neu laden.</div>`;
      return;
    }
    const counts = Object.fromEntries((stats.data || []).map((s) => [s.user_id, s]));
    const me = MavoAuth.user.id;
    const roleName = { member: "Mitglied", team: "Team", admin: "Admin" };
    view.innerHTML = `
      <div class="view-head">
        <div><h2>Nutzer</h2><p class="muted">${prof.data.length} Mitglieder · Rollen vergeben, im Forum sperren, Profile ansehen.</p></div>
      </div>
      <div class="filter-bar">
        <label class="search-field">${icon("search")}<input type="search" class="input" id="userSearch" placeholder="Nach Namen suchen…" value="${esc(userFilter)}"></label>
        <select class="select" id="userRoleFilter">
          <option value="">Alle Rollen</option><option value="admin">Admins</option><option value="team">Team</option>
          <option value="member">Mitglieder</option><option value="banned">Gesperrt</option>
        </select>
      </div>
      <div class="user-list">${prof.data.map((p) => {
        const st = counts[p.user_id] || {};
        return `
        <div class="user-row" data-name="${esc(p.display_name.toLowerCase())}" data-role="${p.role}" data-banned="${p.banned}">
          ${p.avatar_url ? `<img class="avatar" src="${esc(p.avatar_url)}" alt="">` : `<span class="avatar avatar--letter">${esc(p.display_name[0] || "?")}</span>`}
          <div class="user-row__main">
            <a href="index.html#forum/user/${esc(p.user_id)}" target="_blank"><strong>${esc(p.display_name)}</strong></a>
            ${p.banned ? '<span class="role role--banned">Gesperrt</span>' : ""}${p.user_id === me ? '<span class="role">Du</span>' : ""}
            <small>${st.post_count || 0} Beiträge · seit ${new Date(p.created_at).toLocaleDateString("de-DE")}${st.last_post_at ? ` · zuletzt aktiv ${new Date(st.last_post_at).toLocaleDateString("de-DE")}` : ""}</small>
          </div>
          <select class="select select--sm" data-setrole="${p.user_id}" ${p.user_id === me ? "disabled" : ""} aria-label="Rolle">
            ${["member", "team", "admin"].map((r) => `<option value="${r}" ${p.role === r ? "selected" : ""}>${roleName[r]}</option>`).join("")}
          </select>
          ${p.user_id === me ? "<span></span>" : `<button class="btn btn--ghost btn--sm ${p.banned ? "" : "btn--danger"}" data-ban="${p.user_id}" data-banned="${p.banned}">${p.banned ? "Entsperren" : "Sperren"}</button>`}
        </div>`;
      }).join("") || `<div class="empty">Noch keine Nutzer.</div>`}</div>`;

    const applyFilter = () => {
      const q = $("#userSearch").value.toLowerCase();
      const r = $("#userRoleFilter").value;
      userFilter = $("#userSearch").value;
      $$(".user-row", view).forEach((row) => {
        const roleOk = !r || (r === "banned" ? row.dataset.banned === "true" : row.dataset.role === r);
        row.hidden = !(row.dataset.name.includes(q) && roleOk);
      });
    };
    $("#userSearch").addEventListener("input", applyFilter);
    $("#userRoleFilter").addEventListener("change", applyFilter);
    applyFilter();
  }

  $("#usersView").addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-setrole]");
    if (!sel) return;
    if (sel.value === "admin" && !confirm("Diese Person zum Admin machen? Admins können alles bearbeiten und löschen.")) { loadUsers(); return; }
    const { error } = await sb.rpc("admin_set_role", { p_user: sel.dataset.setrole, p_role: sel.value });
    if (error) { showToast("Fehler: " + error.message); loadUsers(); return; }
    showToast("Rolle geändert ✓");
    loadUsers();
  });
  $("#usersView").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ban]");
    if (!b) return;
    const banned = b.dataset.banned === "true";
    if (!banned && !confirm("Diese Person im Forum sperren? Sie kann dann nichts mehr schreiben, liken oder abstimmen.")) return;
    const { error } = await sb.rpc("admin_set_banned", { p_user: b.dataset.ban, p_banned: !banned });
    if (error) return showToast("Fehler: " + error.message);
    showToast(banned ? "Entsperrt ✓" : "Gesperrt ✓");
    loadUsers();
  });

  /* ==========================================================
     Navigation (Seitenleiste) & Start
     ========================================================== */
  const COMMUNITY = [
    ["reports", "flag", "Meldungen"],
    ["users", "users", "Nutzer"],
    ["polls", "chart", "Umfragen"],
    ["quiz", "check-circle", "Quiz-Ergebnisse"],
  ];
  const loaders = { dashboard: loadDashboard, reports: loadReports, users: loadUsers, polls: loadPolls, quiz: loadQuiz };
  let current = "dashboard";
  let openCount = 0;

  function renderNav() {
    const item = (nav, ic, label, extra = "") => `
      <button class="admin-nav__item ${current === nav ? "is-active" : ""}" data-nav="${nav}">${icon(ic)}<span>${label}</span>${extra}</button>`;
    $("#adminNavList").innerHTML = `
      ${item("dashboard", "dashboard", "Übersicht")}
      <span class="admin-nav__label">Inhalte</span>
      ${Object.entries(SECTIONS).map(([key, s]) => item(`content:${key}`, s.icon || "file", s.label,
        dirty.has(key) ? '<span class="dirty" title="Ungespeichert"></span>' : "")).join("")}
      <span class="admin-nav__label">Community</span>
      ${COMMUNITY.map(([nav, ic, label]) => item(nav, ic, label,
        nav === "reports" && openCount ? `<span class="count">${openCount}</span>` : "")).join("")}`;
    const label = current.startsWith("content:") ? SECTIONS[current.slice(8)]?.label
      : current === "dashboard" ? "Übersicht" : COMMUNITY.find(([n]) => n === current)?.[2];
    $("#adminNavCurrent").textContent = label || "";
  }

  function show(nav, { add = false, push = true } = {}) {
    if (!canSave && !nav.startsWith("content:") && nav !== "dashboard") nav = "dashboard";
    current = nav;
    if (push && location.hash !== "#" + nav) history.replaceState(null, "", "#" + nav);
    const panel = nav.startsWith("content:") ? "content" : nav;
    $$("[data-view-panel]").forEach((p) => (p.hidden = p.dataset.viewPanel !== panel));
    if (panel === "content") {
      section = nav.slice(8);
      if (!SECTIONS[section]) { section = "news"; current = "content:news"; }
      openIndex = null;
      if (add) { items().unshift(SECTIONS[section].blank()); openIndex = 0; markDirty(); }
      renderEditor();
    } else {
      loaders[panel]?.();
    }
    renderNav();
    $(".admin-shell").classList.remove("nav-open");
    window.scrollTo({ top: 0 });
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-nav]");
    if (!b) return;
    e.preventDefault();
    show(b.dataset.nav, { add: !!b.dataset.add });
  });
  $("#adminNavToggle").addEventListener("click", () => $(".admin-shell").classList.toggle("nav-open"));

  async function refreshReportCount() {
    if (!canSave) return;
    const { count } = await sb.from("forum_reports").select("id", { count: "exact", head: true }).eq("resolved", false);
    openCount = count || 0;
    renderNav();
  }

  async function init() {
    sb = await getSupabase();
    await MavoAuth.ready;
    await contentReady;
    canSave = !!(sb && MavoAuth.user?.isAdmin);
    renderUser();
    renderNotice();
    // Mit Supabase, aber ohne Admin-Rechte: Bereich gesperrt
    const locked = MavoAuth.enabled && !canSave;
    $(".admin-shell").classList.toggle("is-locked", locked);
    if (locked) { $$("[data-view-panel]").forEach((p) => (p.hidden = true)); return; }
    const start = decodeURIComponent(location.hash.slice(1)) || "dashboard";
    show(start, { push: false });
    refreshReportCount();
  }

  MavoAuth.onChange(init);
  init();
})();
