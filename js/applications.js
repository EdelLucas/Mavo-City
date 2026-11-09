/* ==========================================================
   Mavo City – Fraktions-Bewerbungen
   Formular im Dialog (Discord-Login nötig). Ohne Supabase werden
   Bewerbungen nur lokal gespeichert (Demo-Modus).
   Tabelle: faction_applications (supabase/update-5-website.sql)
   ========================================================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = window.escapeHtml;
  const LOCAL = "mavo_demo_applications";
  const STATUS = () => ({ offen: t("Eingereicht"), bearbeitung: t("In Bearbeitung"), angenommen: t("Angenommen"), abgelehnt: t("Abgelehnt") });

  // Bereich "Meine Bewerbungen" über den Fraktions-Karten
  const box = document.createElement("div");
  box.className = "my-apps";
  box.id = "myApps";
  box.hidden = true;
  $("#factionGrid").before(box);

  const demo = () => !MavoAuth.enabled;
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL)) || []; } catch { return []; } };

  async function myApps() {
    if (demo()) return readLocal();
    if (!MavoAuth.user) return [];
    const sb = await getSupabase();
    const { data, error } = await sb.from("faction_applications")
      .select("id, faction, char_name, status, team_note, created_at")
      .eq("user_id", MavoAuth.user.id).order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    return data;
  }

  async function renderMine() {
    await getSupabase();
    let list = [];
    try { list = await myApps(); } catch { list = []; }
    box.hidden = !list.length;
    box.innerHTML = list.length ? `
      <h2 class="section__title" style="margin-bottom:6px">${t("Meine Bewerbungen")}</h2>
      ${list.map((a) => `
        <div class="my-app">
          <div>
            <strong>${esc(a.faction)} · ${esc(a.char_name)}</strong>
            <small>${new Date(a.created_at).toLocaleDateString(getLang() === "en" ? "en-GB" : "de-DE")}${a.team_note ? ` · ${t("Team")}: ${esc(a.team_note)}` : ""}</small>
          </div>
          <span class="app-status app-status--${esc(a.status)}">${esc(STATUS()[a.status] || a.status)}</span>
        </div>`).join("")}` : "";
  }

  function formHtml(faction) {
    return `
      <h2 id="modalTitle">${t("Bewerbung")}: ${esc(faction.name)}</h2>
      <p class="muted">${t("Erzähl uns von deinem Charakter. Das Team meldet sich im Discord bei dir.")}${demo() ? ` <strong>(${t("Demo-Modus – wird nur lokal gespeichert")})</strong>` : ""}</p>
      <form class="form" id="appForm">
        <div class="form__row">
          <label>${t("Name deines Charakters")}<input class="input" name="char_name" required minlength="2" maxlength="80" autofocus></label>
          <label>${t("Alter des Charakters")}<input class="input" name="char_age" type="number" min="0" max="120"></label>
        </div>
        <div class="form__row">
          <label>${t("Dein echtes Alter")}<input class="input" name="age" type="number" min="12" max="99" required></label>
          <label>${t("Spielzeit auf Mavo City")}<input class="input" name="playtime" maxlength="120" placeholder="${t("z. B. 3 Wochen, ca. 40 Stunden")}"></label>
        </div>
        <label>${t("Lebenslauf deines Charakters")} <small>${t("mind. 30 Zeichen")}</small>
          <textarea name="story" required minlength="30" maxlength="4000"></textarea></label>
        <label>${t("Warum diese Fraktion?")} <small>${t("mind. 20 Zeichen")}</small>
          <textarea name="motivation" required minlength="20" maxlength="2000"></textarea></label>
        ${faction.requirements?.length ? `
          <div class="callout"><strong>${t("Voraussetzungen")}</strong>${faction.requirements.map((r) => esc(r)).join(" · ")}</div>` : ""}
        <div class="form__actions">
          <button type="button" class="btn btn--ghost" data-modal-close>${t("Abbrechen")}</button>
          <button type="submit" class="btn btn--primary">${icon("send")} ${t("Bewerbung abschicken")}</button>
        </div>
      </form>`;
  }

  async function submit(form, faction) {
    const f = Object.fromEntries(new FormData(form));
    const row = {
      faction: faction.name,
      char_name: f.char_name.trim(),
      char_age: f.char_age ? Number(f.char_age) : null,
      age: f.age ? Number(f.age) : null,
      playtime: f.playtime.trim() || null,
      story: f.story.trim(),
      motivation: f.motivation.trim(),
    };
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      if (demo()) {
        const list = readLocal();
        list.unshift({ ...row, id: String(Date.now()), status: "offen", created_at: new Date().toISOString() });
        localStorage.setItem(LOCAL, JSON.stringify(list.slice(0, 20)));
      } else {
        const sb = await getSupabase();
        const { error } = await sb.from("faction_applications").insert(row);
        if (error) throw error;
      }
      Modal.close();
      showToast(t("Bewerbung abgeschickt – viel Erfolg!"));
      renderMine();
    } catch (err) {
      btn.disabled = false;
      showToast(t("Fehler") + ": " + (err.message || err));
    }
  }

  async function openApply(index) {
    const faction = CONTENT.factions[index];
    if (!faction) return;
    await getSupabase();
    if (!demo()) {
      await MavoAuth.ready;
      if (!MavoAuth.user) {
        Modal.open(`
          <h2 id="modalTitle">${t("Bewerbung")}: ${esc(faction.name)}</h2>
          <p class="muted">${t("Melde dich mit Discord an, damit das Team dich nach deiner Bewerbung erreichen kann.")}</p>
          <div class="form__actions"><button class="btn btn--discord" data-apply-login>${icon("discord")} ${t("Mit Discord anmelden")}</button></div>`);
        return;
      }
    }
    Modal.open(formHtml(faction), {
      onOpen: (b) => $("#appForm", b).addEventListener("submit", (e) => { e.preventDefault(); submit(e.target, faction); }),
    });
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-apply]");
    if (b) openApply(Number(b.dataset.apply));
    if (e.target.closest("[data-apply-login]")) MavoAuth.login().catch((err) => showToast(err.message));
  });

  MavoAuth.onChange(renderMine);
  Promise.resolve(MavoAuth.ready).then(renderMine);
  document.addEventListener("langchange", renderMine);
})();
