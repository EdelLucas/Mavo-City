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
      label: "📰 News", varName: "NEWS", hint: "Erscheinen auf der Startseite. Neueste oben.",
      title: (i) => `${i.date || ""} – ${i.title || "Neue News"}`,
      blank: () => ({ date: new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }), title: "", text: "" }),
      fields: [
        { k: "date", label: "Datum", type: "text", help: "z. B. 08.11.2026" },
        { k: "title", label: "Titel", type: "text" },
        { k: "text", label: "Text", type: "textarea", wide: true },
      ],
    },
    events: {
      label: "📅 Events", varName: "EVENTS", hint: "Werden automatisch nach Datum sortiert. Zeiten in deutscher Zeit.",
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
      label: "🔧 Updates", varName: "CHANGELOG", hint: "Neueste Version oben.",
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
      label: "📚 Wiki", varName: "WIKI", hint: "Artikel mit Formatierung (# Überschrift, **fett**, - Liste, | Tabelle |).",
      title: (i) => `${i.icon || "📄"} ${i.title || "Neuer Artikel"}`,
      blank: () => ({ id: "", icon: "📄", title: "", category: "", content: "# Titel\n\nText…" }),
      fields: [
        { k: "title", label: "Titel", type: "text" },
        { k: "id", label: "Kurzname für den Link", type: "text", help: "nur a-z, 0-9, - (z. B. strafkatalog)" },
        { k: "category", label: "Kategorie", type: "text" },
        { k: "icon", label: "Symbol (Emoji)", type: "text" },
        { k: "content", label: "Inhalt", type: "md", wide: true },
      ],
    },
    team: {
      label: "👥 Team", varName: "TEAM",
      title: (i) => `${i.name || "Neues Mitglied"} – ${i.role || ""}`,
      blank: () => ({ name: "", role: "", avatar: "" }),
      fields: [
        { k: "name", label: "Name", type: "text" },
        { k: "role", label: "Rolle", type: "text" },
        { k: "avatar", label: "Profilbild (optional)", type: "image", wide: true },
      ],
    },
    factions: {
      label: "🚓 Fraktionen", varName: "FACTIONS",
      title: (i) => `${i.icon || ""} ${i.name || "Neue Fraktion"}`,
      blank: () => ({ name: "", short: "", type: "zivil", icon: "🏢", status: "offen", desc: "", requirements: [] }),
      fields: [
        { k: "name", label: "Name", type: "text" },
        { k: "short", label: "Kürzel", type: "text" },
        { k: "type", label: "Art", type: "select", options: [["staat", "Staat"], ["zivil", "Zivil"], ["crime", "Crime"]] },
        { k: "status", label: "Bewerbungen", type: "select", options: [["offen", "offen"], ["geschlossen", "geschlossen"]] },
        { k: "icon", label: "Symbol (Emoji)", type: "text" },
        { k: "desc", label: "Beschreibung", type: "textarea", wide: true },
        { k: "requirements", label: "Voraussetzungen", type: "list", wide: true, help: "Eine pro Zeile" },
      ],
    },
    gallery: {
      label: "🖼️ Galerie", varName: "GALLERY",
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
      label: "🌆 Startseiten-Bilder", varName: "HERO_IMAGES", hint: "Hintergrundbilder oben auf der Startseite (wechseln automatisch).",
      title: (i) => i.src ? i.src.split("/").pop() : "Neues Bild",
      blank: () => ({ src: "" }),
      fields: [{ k: "src", label: "Bild", type: "image", wide: true }],
      toCode: (items) => items.map((i) => i.src),
    },
    map: {
      label: "🗺️ Karte", varName: "MAP_LOCATIONS",
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
      label: "🎥 Streamer", varName: "STREAMERS",
      title: (i) => i.name || "Neuer Streamer",
      blank: () => ({ name: "", twitch: "", desc: "" }),
      fields: [
        { k: "name", label: "Name", type: "text" },
        { k: "twitch", label: "Twitch-Kanal", type: "text", help: "aus twitch.tv/KANAL" },
        { k: "desc", label: "Beschreibung", type: "textarea", wide: true },
      ],
    },
    quiz: {
      label: "✅ Regel-Quiz", varName: "QUIZ",
      title: (i) => i.q || "Neue Frage",
      blank: () => ({ q: "", answers: ["", "", ""], correct: 0 }),
      fields: [
        { k: "q", label: "Frage", type: "text", wide: true },
        { k: "answers", label: "Antworten", type: "list", wide: true, help: "Eine pro Zeile" },
        { k: "correct", label: "Richtige Antwort", type: "correct", help: "Nummer der richtigen Zeile (1 = erste)" },
      ],
    },
    packages: {
      label: "💛 Spenden-Pakete", varName: "DONATION_PACKAGES", hint: "Bitte nur kosmetische Vorteile – kein Pay2Win.",
      title: (i) => `${i.icon || ""} ${i.name || "Neues Paket"} – ${i.price || ""}`,
      blank: () => ({ name: "", price: "", icon: "💛", highlight: false, perks: [] }),
      fields: [
        { k: "name", label: "Name", type: "text" },
        { k: "price", label: "Preis", type: "text", help: "z. B. 4,99 €" },
        { k: "icon", label: "Symbol (Emoji)", type: "text" },
        { k: "highlight", label: "Als „Beliebt“ hervorheben", type: "check" },
        { k: "perks", label: "Vorteile", type: "list", wide: true, help: "Einer pro Zeile" },
      ],
    },
  };

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
    $("#adminUser").innerHTML = !MavoAuth.enabled ? `<a href="index.html">← Zur Website</a>` : u
      ? `${u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : ""}<span>${esc(u.name)}</span>
         <button class="btn btn--ghost btn--sm" id="logoutBtn">Abmelden</button>`
      : `<button class="btn btn--discord btn--sm" id="loginBtn">Mit Discord anmelden</button>`;
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
        Danach diese Seite neu laden.</div>`;
    }
    $("#adminNotice").innerHTML = html;
  }

  /* ==========================================================
     Inhalte bearbeiten
     ========================================================== */
  function renderSectionList() {
    $("#sectionList").innerHTML = Object.entries(SECTIONS).map(([key, s]) => `
      <button data-section="${key}" class="${key === section ? "is-active" : ""}">
        <span>${s.label}</span>${dirty.has(key) ? '<span class="dirty" title="Ungespeichert"></span>' : ""}
      </button>`).join("");
  }

  function fieldHtml(f, item, idx) {
    const id = `f-${idx}-${f.k}`;
    const v = item[f.k];
    const base = `data-i="${idx}" data-k="${f.k}" id="${id}"`;
    let input;
    switch (f.type) {
      case "textarea": input = `<textarea ${base}>${esc(v)}</textarea>`; break;
      case "md":
        input = `<textarea class="big" ${base}>${esc(v)}</textarea>
                 <button type="button" class="btn btn--ghost btn--sm" data-mdprev="${idx}">Vorschau anzeigen</button>
                 <div class="md-preview md" id="prev-${idx}" hidden></div>`;
        break;
      case "number": input = `<input type="number" step="0.5" min="0" max="100" ${base} value="${esc(v)}">`; break;
      case "datetime": input = `<input type="datetime-local" ${base} value="${esc(v)}">`; break;
      case "select":
        input = `<select ${base}>${f.options.map(([val, lab]) => `<option value="${esc(val)}" ${val === v ? "selected" : ""}>${esc(lab)}</option>`).join("")}</select>`;
        break;
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
            ${canSave ? `<label class="btn btn--ghost btn--sm">⬆ Hochladen<input type="file" accept="image/*" hidden data-upload="${idx}" data-uk="${f.k}"></label>` : ""}
          </div>
          ${v ? `<img class="img-preview" src="${esc(v)}" alt="">` : ""}`;
        break;
      case "mappick":
        return `<div class="field"><span>&nbsp;</span><button type="button" class="btn btn--ghost btn--sm" data-pick="${idx}">📍 Auf Karte wählen</button></div>`;
      default: input = `<input type="text" ${base} value="${esc(v)}">`;
    }
    return `<label class="field ${f.wide ? "field--wide" : ""}" for="${id}"><span>${esc(f.label)}</span>${input}${f.help ? `<small>${esc(f.help)}</small>` : ""}</label>`;
  }

  function renderEditor() {
    const s = SECTIONS[section];
    const list = items();
    $("#editor").innerHTML = `
      <div class="editor-head">
        <div><h2>${s.label}</h2>${s.hint ? `<p>${esc(s.hint)}</p>` : ""}</div>
        <button class="btn btn--primary btn--sm" data-act="add">+ Neuer Eintrag</button>
      </div>
      <div class="items">
        ${list.map((item, idx) => `
          <details class="item" ${openIndex === idx ? "open" : ""} data-item="${idx}">
            <summary>
              <span class="item__title">${esc(s.title(item))}</span>
              <span class="item__tools">
                <button type="button" data-act="up" data-idx="${idx}" title="Nach oben">↑</button>
                <button type="button" data-act="down" data-idx="${idx}" title="Nach unten">↓</button>
                <button type="button" data-act="del" data-idx="${idx}" title="Löschen">🗑</button>
              </span>
            </summary>
            <div class="item__body">${s.fields.map((f) => fieldHtml(f, item, idx)).join("")}</div>
          </details>`).join("") || `<div class="empty">Noch keine Einträge.</div>`}
      </div>
      <div class="save-bar">
        <span class="hint">${dirty.has(section) ? "● Ungespeicherte Änderungen" : "Alles gespeichert"}</span>
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
    renderSectionList();
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
      box.innerHTML = renderMarkdown(items()[idx].content || "");
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
    renderSectionList(); renderEditor();
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
    renderSectionList(); renderEditor();
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

  $("#sectionList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-section]");
    if (!b) return;
    section = b.dataset.section;
    openIndex = null;
    renderSectionList(); renderEditor();
  });

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
    $("#reportCount").textContent = open || "";
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
     Reiter & Start
     ========================================================== */
  const loaders = { reports: loadReports, polls: loadPolls, quiz: loadQuiz };
  $("#adminTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    $$("#adminTabs .chip").forEach((c) => c.classList.toggle("is-active", c === b));
    $$("[data-view-panel]").forEach((p) => (p.hidden = p.dataset.viewPanel !== b.dataset.view));
    loaders[b.dataset.view]?.();
  });

  async function init() {
    sb = await getSupabase();
    await MavoAuth.ready;
    await contentReady;
    canSave = !!(sb && MavoAuth.user?.isAdmin);
    renderUser();
    renderNotice();
    // Ohne Login/Adminrechte mit Supabase: Editor ausblenden
    const locked = MavoAuth.enabled && !canSave;
    $("#adminTabs").hidden = locked;
    $$("[data-view-panel]").forEach((p) => (p.hidden = locked || p.dataset.viewPanel !== "content"));
    if (locked) return;
    renderSectionList();
    renderEditor();
    if (canSave) loadReports(); // Zähler für offene Meldungen
  }

  MavoAuth.onChange(init);
  init();
})();
