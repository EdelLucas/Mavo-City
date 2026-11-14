/* ==========================================================
   Mavo City – Whitelist-Bewerbung (Tab "bewerbung")

   Mit Supabase: Bewerbung landet in der Tabelle "whitelist_applications"
   (supabase/update-5-whitelist.sql). Anmeldung über Discord, das Team
   prüft im Admin-Bereich → "Whitelist". Status sieht man hier.
   Ohne Supabase (Demo): Bewerbung wird nur lokal im Browser gespeichert.
   ========================================================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = window.escapeHtml;
  const LOCAL_KEY = "mavo_whitelist_demo";
  const QUIZ_KEY = "mavo_quiz_passed";
  const DRAFT_KEY = "mavo_whitelist_draft";
  const MIN_STORY = 300;
  const MIN_SCENARIO = 50;

  const STATUS = {
    offen:       { label: "Eingegangen",    cls: "open",     icon: "clock",        text: "Deine Bewerbung ist eingegangen und wartet auf Prüfung. Das dauert in der Regel bis zu 48 Stunden." },
    bearbeitung: { label: "In Prüfung",     cls: "progress", icon: "eye",          text: "Ein Teammitglied schaut sich deine Bewerbung gerade an." },
    angenommen:  { label: "Angenommen",     cls: "ok",       icon: "check-circle", text: "Willkommen in Mavo City! Du bist freigeschaltet und kannst dich jetzt verbinden." },
    abgelehnt:   { label: "Abgelehnt",      cls: "no",       icon: "x-circle",     text: "Leider hat es diesmal nicht geklappt. Lies dir die Rückmeldung durch – du kannst dich erneut bewerben." },
  };

  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* egal */ } };
  const quizPassed = () => !!read(QUIZ_KEY);

  let sb = null;
  let latest = null;      // letzte eigene Bewerbung
  let showForm = false;   // nach Ablehnung: neue Bewerbung schreiben
  let loaded = false;

  async function load() {
    sb = await getSupabase();
    await MavoAuth.ready;
    latest = null;
    if (sb && MavoAuth.user) {
      const { data, error } = await sb.from("whitelist_applications")
        .select("id, status, staff_note, reviewed_by, created_at, updated_at, char_name")
        .order("created_at", { ascending: false }).limit(1);
      if (error) console.error("Whitelist:", error.message);
      latest = data?.[0] || null;
    } else if (!sb) {
      try { latest = JSON.parse(read(LOCAL_KEY)); } catch { latest = null; }
    }
    loaded = true;
    render();
  }

  /* ---------- Ansichten ---------- */
  const req = (ok, label, action = "") => `
    <li class="apply-req ${ok ? "is-ok" : ""}">
      ${icon(ok ? "check-circle" : "x-circle")}<span>${label}</span>${ok ? "" : action}
    </li>`;

  function requirements() {
    const needLogin = MavoAuth.enabled;
    const loggedIn = !!MavoAuth.user;
    return `
      <ul class="apply-reqs">
        ${req(quizPassed(), t("Regel-Quiz bestanden"),
          `<a class="btn btn--primary btn--sm" href="#quiz">${t("Zum Quiz")}</a>`)}
        ${needLogin ? req(loggedIn, loggedIn ? t("Angemeldet als {n}", { n: esc(MavoAuth.user.name) }) : t("Mit Discord angemeldet"),
          `<button class="btn btn--discord btn--sm" data-apply="login">${icon("discord")} ${t("Anmelden")}</button>`) : ""}
        ${req(true, t("Mindestens 18 Jahre alt"))}
      </ul>`;
  }

  function statusView(app) {
    const s = STATUS[app.status] || STATUS.offen;
    const date = new Date(app.created_at).toLocaleDateString(getLang() === "en" ? "en-GB" : "de-DE");
    return `
      <div class="apply-status apply-status--${s.cls} card">
        <div class="apply-status__icon">${icon(s.icon)}</div>
        <div class="apply-status__body">
          <span class="tag"><span class="dot dot--${s.cls}"></span>${t(s.label)}</span>
          <h2>${esc(app.char_name)}</h2>
          <p>${t(s.text)}</p>
          ${app.staff_note ? `<blockquote class="apply-status__note"><strong>${t("Rückmeldung vom Team")}${app.reviewed_by ? ` · ${esc(app.reviewed_by)}` : ""}</strong>${esc(app.staff_note)}</blockquote>` : ""}
          <p class="muted apply-status__meta">${t("Eingereicht am {d}", { d: date })}${!sb ? ` · ${t("Demo-Modus: nur in diesem Browser gespeichert")}` : ""}</p>
          <div class="btn-row">
            ${app.status === "angenommen"
              ? `<a class="btn btn--primary" href="#verbinden">${icon("play")} ${t("Jetzt verbinden")}</a>`
              : app.status === "abgelehnt"
                ? `<button class="btn btn--primary" data-apply="again">${t("Neue Bewerbung schreiben")}</button>`
                : `<a class="btn btn--ghost js-discord" href="${esc(CONFIG.discordUrl)}" target="_blank" rel="noopener">${icon("discord")} ${t("Fragen? Zum Discord")}</a>`}
            ${!sb ? `<button class="btn btn--ghost" data-apply="reset">${t("Demo zurücksetzen")}</button>` : ""}
          </div>
        </div>
      </div>`;
  }

  function formView() {
    let d = {};
    try { d = JSON.parse(read(DRAFT_KEY)) || {}; } catch { /* egal */ }
    const v = (k) => esc(d[k] ?? "");
    return `
      <form class="form apply-form" id="applyForm" novalidate>
        <fieldset>
          <legend>${icon("users")} ${t("Über dich")}</legend>
          <div class="apply-grid">
            <label class="field"><span>${t("Discord-Name")}</span>
              <input name="discord" ${MavoAuth.user ? `value="${esc(MavoAuth.user.name)}" readonly` : `value="${v("discord")}" required maxlength="40"`} autocomplete="nickname"></label>
            <label class="field"><span>${t("Dein Alter")}</span>
              <input name="age" type="number" min="18" max="99" inputmode="numeric" required value="${v("age")}"></label>
          </div>
          <label class="field"><span>${t("Wie hast du von uns erfahren?")}</span>
            <select name="source" class="input">
              ${["", "Freunde", "TikTok", "YouTube", "Twitch", "FiveM-Serverliste", "Discord", "Sonstiges"].map((o) =>
                `<option value="${o}" ${d.source === o ? "selected" : ""}>${o ? t(o) : t("Bitte wählen…")}</option>`).join("")}
            </select></label>
          <label class="field"><span>${t("Deine RP-Erfahrung")}</span>
            <textarea name="experience" rows="3" required maxlength="1500" placeholder="${t("Auf welchen Servern hast du gespielt? Wie lange schon?")}">${v("experience")}</textarea></label>
        </fieldset>

        <fieldset>
          <legend>${icon("file")} ${t("Dein Charakter")}</legend>
          <div class="apply-grid">
            <label class="field"><span>${t("Name des Charakters")}</span>
              <input name="char_name" required minlength="3" maxlength="60" placeholder="z. B. Tony Marino" value="${v("char_name")}"></label>
            <label class="field"><span>${t("Alter des Charakters")}</span>
              <input name="char_age" type="number" min="16" max="99" inputmode="numeric" value="${v("char_age")}"></label>
          </div>
          <label class="field"><span>${t("Hintergrundgeschichte")} <small class="apply-count" data-count="story" data-min="${MIN_STORY}"></small></span>
            <textarea name="story" rows="8" required maxlength="4000" placeholder="${t("Woher kommt dein Charakter, was treibt ihn an, warum ist er in Mavo City?")}">${v("story")}</textarea></label>
        </fieldset>

        <fieldset>
          <legend>${icon("shield")} ${t("Regelverständnis")}</legend>
          <label class="field"><span>${t("Du wirst ohne RP-Grund aus einem Auto gezogen und ausgeraubt. Wie reagierst du – ingame und danach?")} <small class="apply-count" data-count="scenario" data-min="${MIN_SCENARIO}"></small></span>
            <textarea name="scenario" rows="4" required maxlength="1500">${v("scenario")}</textarea></label>
          <label class="apply-check"><input type="checkbox" name="rules" required ${d.rules ? "checked" : ""}>
            <span>${t("Ich habe das <a href=\"#regeln\">Regelwerk</a> gelesen und akzeptiere es.")}</span></label>
        </fieldset>

        <p class="apply-error" id="applyError" role="alert" hidden></p>
        <div class="form__actions">
          <span class="muted apply-saved">${t("Entwurf wird automatisch gespeichert")}</span>
          <button class="btn btn--primary" type="submit">${t("Bewerbung absenden")} ${icon("arrow-right")}</button>
        </div>
      </form>`;
  }

  function render() {
    const view = $("#applyView");
    if (!loaded) return;
    const open = latest && ["offen", "bearbeitung", "angenommen"].includes(latest.status);
    const rejected = latest?.status === "abgelehnt";
    const canWrite = quizPassed() && (!MavoAuth.enabled || MavoAuth.user);

    if (open) { view.innerHTML = statusView(latest); return; }
    if (rejected && !showForm) { view.innerHTML = statusView(latest); return; }

    view.innerHTML = `
      <div class="apply">
        <aside class="apply__side">
          <div class="card">
            <h3>${t("Voraussetzungen")}</h3>
            ${requirements()}
          </div>
          <div class="card apply__tips">
            <h3>${t("Tipps für eine gute Bewerbung")}</h3>
            <ul>
              <li>${t("Schreib in ganzen Sätzen – Qualität vor Länge.")}</li>
              <li>${t("Dein Charakter braucht Stärken <em>und</em> Schwächen.")}</li>
              <li>${t("Keine Superhelden, keine Promi-Kopien.")}</li>
              <li>${t("Kopierte Geschichten werden abgelehnt.")}</li>
            </ul>
          </div>
        </aside>
        <div class="apply__main">
          ${canWrite ? formView() : `
            <div class="empty apply__locked">
              ${icon("lock")}
              <p><strong>${t("Fast geschafft!")}</strong><br>${t("Erfülle zuerst die Voraussetzungen links – dann erscheint hier das Formular.")}</p>
            </div>`}
        </div>
      </div>`;
    if (canWrite) bindForm();
  }

  /* ---------- Formular ---------- */
  function bindForm() {
    const form = $("#applyForm");
    const updateCounts = () => form.querySelectorAll("[data-count]").forEach((el) => {
      const len = form.elements[el.dataset.count].value.trim().length;
      const min = Number(el.dataset.min);
      el.textContent = len < min ? t("noch {n} Zeichen", { n: min - len }) : `✓ ${len}`;
      el.classList.toggle("is-ok", len >= min);
    });
    updateCounts();

    let draftTimer;
    form.addEventListener("input", () => {
      updateCounts();
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => {
        const data = Object.fromEntries(new FormData(form));
        data.rules = form.elements.rules.checked;
        write(DRAFT_KEY, JSON.stringify(data));
      }, 400);
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = form.elements;
      const val = (n) => f[n].value.trim();
      const err = (msg, field) => {
        const box = $("#applyError");
        box.textContent = msg; box.hidden = false;
        if (field) { f[field].focus(); f[field].classList.add("is-invalid"); }
        return false;
      };
      form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
      const age = Number(val("age"));
      if (!val("discord")) return err(t("Bitte gib deinen Discord-Namen an."), "discord");
      if (!(age >= 18 && age <= 99)) return err(t("Du musst mindestens 18 Jahre alt sein."), "age");
      if (val("experience").length < 10) return err(t("Erzähl uns kurz von deiner RP-Erfahrung."), "experience");
      if (val("char_name").length < 3) return err(t("Bitte gib den Namen deines Charakters an."), "char_name");
      if (val("story").length < MIN_STORY) return err(t("Die Hintergrundgeschichte braucht mindestens {n} Zeichen.", { n: MIN_STORY }), "story");
      if (val("scenario").length < MIN_SCENARIO) return err(t("Bitte beantworte die Regelfrage ausführlicher."), "scenario");
      if (!f.rules.checked) return err(t("Bitte bestätige, dass du das Regelwerk akzeptierst."), "rules");

      const row = {
        age,
        char_name: val("char_name"),
        char_age: val("char_age") ? Number(val("char_age")) : null,
        story: val("story"),
        experience: val("experience"),
        scenario: val("scenario"),
        source: f.source.value || null,
      };
      const btn = form.querySelector("[type=submit]");
      btn.disabled = true;

      if (sb) {
        // discord_name wird in der Datenbank aus dem Login gesetzt
        const { error } = await sb.from("whitelist_applications").insert({ ...row, discord_name: MavoAuth.user.name });
        if (error) {
          btn.disabled = false;
          return err(error.code === "23505" ? t("Du hast bereits eine offene Bewerbung.")
            : error.code === "42P01" ? t("Bewerbungen sind noch nicht eingerichtet (Admin: update-5-whitelist.sql ausführen).")
            : `${t("Fehler beim Senden:")} ${error.message}`);
        }
      } else {
        write(LOCAL_KEY, JSON.stringify({ ...row, discord_name: val("discord"), status: "offen", created_at: new Date().toISOString() }));
      }
      write(DRAFT_KEY, null);
      showForm = false;
      showToast(t("Bewerbung abgeschickt – viel Glück!"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      load();
    });
  }

  /* ---------- Aktionen ---------- */
  $("#applyView").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-apply]");
    if (!b) return;
    const act = b.dataset.apply;
    if (act === "login") await MavoAuth.login();
    if (act === "again") { showForm = true; render(); }
    if (act === "reset") { write(LOCAL_KEY, null); latest = null; render(); }
  });

  document.addEventListener("tabchange", (e) => { if (e.detail === "bewerbung") loaded ? render() : load(); });
  document.addEventListener("langchange", render);
  MavoAuth.onChange(load);
  if (location.hash.startsWith("#bewerbung")) load();
  else loaded = false;
})();
