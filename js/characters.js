/* ==========================================================
   Mavo City – Bürgerregister (Charaktere)
   Jeder Spieler kann bis zu 3 Charaktere mit Bild und
   Hintergrundgeschichte vorstellen. Tabelle: characters
   (supabase/update-5-website.sql). Ohne Supabase: Demo im Browser.
   ========================================================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = window.escapeHtml;
  const LOCAL = "mavo_demo_characters";
  const MAX = 3;
  const view = $("#charView");

  let list = [];
  let query = "";
  let filter = "";
  let loaded = false;

  const demo = () => !MavoAuth.enabled;
  const me = () => (demo() ? { id: "demo", name: t("Du (Demo)") } : MavoAuth.user);

  /* ---------- Speicher ---------- */
  const DEMO_SEED = [
    { id: "d1", user_id: "x", owner_name: "Lucas", name: "Vincent Moreau", age: 34, job: "Anwalt", faction: "Justiz", origin: "Marseille",
      bio: "Kam vor fünf Jahren nach Los Santos, um neu anzufangen. Verteidigt jeden – solange die Bezahlung stimmt.", image_url: "", created_at: "2026-11-02T10:00:00Z" },
    { id: "d2", user_id: "y", owner_name: "Lena", name: "Mia Kowalski", age: 27, job: "Notärztin", faction: "Rettungsdienst", origin: "Danzig",
      bio: "Ruhig, zielstrebig und immer zuerst am Unfallort.", image_url: "", created_at: "2026-11-03T10:00:00Z" },
  ];
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL)) || []; } catch { return []; } };
  const writeLocal = (l) => { try { localStorage.setItem(LOCAL, JSON.stringify(l)); } catch { /* egal */ } };

  const store = {
    async all() {
      if (demo()) return [...readLocal(), ...DEMO_SEED];
      const sb = await getSupabase();
      const { data, error } = await sb.from("characters").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
    async byUser(userId) {
      const sb = await getSupabase();
      const { data, error } = await sb.from("characters").select("*").eq("user_id", userId).order("created_at");
      if (error) throw error;
      return data;
    },
    async save(row, id) {
      if (demo()) {
        const l = readLocal();
        if (id) Object.assign(l.find((c) => c.id === id) || {}, row);
        else l.unshift({ ...row, id: "local-" + Date.now(), user_id: "demo", owner_name: me().name, created_at: new Date().toISOString() });
        return writeLocal(l);
      }
      const sb = await getSupabase();
      const { error } = id
        ? await sb.from("characters").update(row).eq("id", id)
        : await sb.from("characters").insert(row);
      if (error) throw error;
    },
    async remove(id) {
      if (demo()) return writeLocal(readLocal().filter((c) => c.id !== id));
      const sb = await getSupabase();
      const { error } = await sb.from("characters").delete().eq("id", id);
      if (error) throw error;
    },
    async upload(file) {
      if (demo()) {
        // Demo: Bild als Daten-URL (nur lokal)
        return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      }
      const sb = await getSupabase();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${MavoAuth.user.id}/${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("characters").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      return sb.storage.from("characters").getPublicUrl(path).data.publicUrl;
    },
  };

  /* ---------- Darstellung ---------- */
  const own = (c) => { const u = me(); return !!u && (c.user_id === u.id || (demo() && c.user_id === "demo")); };
  const canEdit = (c) => own(c) || MavoAuth.user?.isAdmin;
  const imgStyle = (c) => (c.image_url ? ` style="background-image:url('${esc(c.image_url).replace(/'/g, "%27")}')"` : "");

  function cardHtml(c) {
    return `
      <button class="card char-card" data-char="${esc(c.id)}">
        <div class="char-card__img"${imgStyle(c)}>${c.image_url ? "" : `<span class="char-letter">${esc((c.name || "?")[0])}</span>`}</div>
        <div class="char-card__body">
          <h3>${esc(c.name)}</h3>
          <div class="char-card__meta">
            ${c.age ? `<span>${esc(c.age)} ${t("Jahre")}</span>` : ""}
            ${c.job ? `<span>${esc(c.job)}</span>` : ""}
          </div>
          ${c.faction ? `<div><span class="tag tag--accent">${esc(c.faction)}</span></div>` : ""}
          <div class="char-card__owner">${c.owner_avatar ? `<img src="${esc(c.owner_avatar)}" alt="" loading="lazy">` : ""}${t("gespielt von")} ${esc(c.owner_name || "?")}</div>
        </div>
      </button>`;
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    return list.filter((c) =>
      (!filter || c.faction === filter) &&
      (!q || [c.name, c.job, c.faction, c.origin, c.owner_name].some((v) => String(v || "").toLowerCase().includes(q))));
  }

  function renderGrid() {
    const items = filtered();
    $("#charGrid", view).innerHTML = items.length
      ? items.map(cardHtml).join("")
      : `<div class="empty">${list.length ? t("Keine Treffer.") : t("Noch keine Charaktere. Stell deinen als Erstes vor!")}</div>`;
  }

  async function render() {
    if (!loaded) view.innerHTML = `<div class="loader">…</div>`;
    await getSupabase(); // klärt, ob Supabase erreichbar ist (sonst Demo)
    try {
      list = await store.all();
      loaded = true;
    } catch (err) {
      view.innerHTML = `<div class="empty">${t("Das Bürgerregister ist noch nicht eingerichtet.")}<br><small>${esc(err.message || err)}</small></div>`;
      return;
    }
    const factions = [...new Set(list.map((c) => c.faction).filter(Boolean))].sort();
    const mine = list.filter(own).length;
    view.innerHTML = `
      ${demo() ? `<p class="demo-note">${icon("info")} ${t("Demo-Modus: Charaktere werden nur in deinem Browser gespeichert.")}</p>` : ""}
      <div class="char-toolbar">
        <label class="search-field">${icon("search")}<input type="search" class="input" id="charSearch" placeholder="${t("Name, Job, Fraktion…")}" value="${esc(query)}" aria-label="${t("Bürger suchen")}"></label>
        ${factions.length ? `<select class="select" id="charFilter" aria-label="${t("Fraktion")}">
          <option value="">${t("Alle Fraktionen")}</option>
          ${factions.map((f) => `<option ${f === filter ? "selected" : ""}>${esc(f)}</option>`).join("")}
        </select>` : ""}
        <button class="btn btn--primary" data-char-new ${mine >= MAX ? `disabled title="${t("Höchstens {n} Charaktere", { n: MAX })}"` : ""}>${icon("plus")} ${t("Charakter vorstellen")}</button>
      </div>
      <div class="char-grid" id="charGrid"></div>`;
    renderGrid();
    $("#charSearch", view).addEventListener("input", (e) => { query = e.target.value; renderGrid(); });
    $("#charFilter", view)?.addEventListener("change", (e) => { filter = e.target.value; renderGrid(); });
  }

  /* ---------- Detail & Formular ---------- */
  function showDetail(c) {
    Modal.open(`
      <div class="char-detail__img"${imgStyle(c)}></div>
      <h2 id="modalTitle">${esc(c.name)}</h2>
      <div class="char-detail__facts">
        ${c.age ? `<span class="tag">${esc(c.age)} ${t("Jahre")}</span>` : ""}
        ${c.job ? `<span class="tag">${esc(c.job)}</span>` : ""}
        ${c.faction ? `<span class="tag tag--accent">${esc(c.faction)}</span>` : ""}
        ${c.origin ? `<span class="tag">${t("Herkunft")}: ${esc(c.origin)}</span>` : ""}
      </div>
      ${c.bio ? `<p class="char-detail__bio">${esc(c.bio)}</p>` : `<p class="muted">${t("Noch keine Geschichte.")}</p>`}
      <p class="muted"><small>${t("gespielt von")} ${c.user_id && !demo() ? `<a href="#forum/user/${esc(c.user_id)}" data-modal-close>${esc(c.owner_name)}</a>` : esc(c.owner_name || "?")}</small></p>
      ${canEdit(c) ? `<div class="form__actions">
        <button class="btn btn--ghost btn--danger" data-char-del="${esc(c.id)}">${t("Löschen")}</button>
        <button class="btn btn--primary" data-char-edit="${esc(c.id)}">${t("Bearbeiten")}</button></div>` : ""}`);
  }

  function factionOptions(current) {
    const names = [...new Set([...CONTENT.factions.map((f) => f.name), current].filter(Boolean))];
    return `<option value="">${t("Keine / Zivilist")}</option>` +
      names.map((n) => `<option ${n === current ? "selected" : ""}>${esc(n)}</option>`).join("");
  }

  function showForm(c = {}) {
    let imageUrl = c.image_url || "";
    Modal.open(`
      <h2 id="modalTitle">${c.id ? t("Charakter bearbeiten") : t("Charakter vorstellen")}</h2>
      <p class="muted">${t("Stell deinen Charakter der Stadt vor – alles hier ist In-Character.")}</p>
      <form class="form" id="charForm">
        <div class="form__row">
          <label>${t("Name")}<input class="input" name="name" required minlength="2" maxlength="60" value="${esc(c.name || "")}" autofocus></label>
          <label>${t("Alter")}<input class="input" name="age" type="number" min="0" max="120" value="${esc(c.age ?? "")}"></label>
        </div>
        <div class="form__row">
          <label>${t("Beruf")}<input class="input" name="job" maxlength="80" value="${esc(c.job || "")}"></label>
          <label>${t("Fraktion")}<select name="faction">${factionOptions(c.faction)}</select></label>
        </div>
        <label>${t("Herkunft")}<input class="input" name="origin" maxlength="80" value="${esc(c.origin || "")}"></label>
        <label>${t("Geschichte")} <small>${t("max. 3000 Zeichen")}</small><textarea name="bio" maxlength="3000">${esc(c.bio || "")}</textarea></label>
        <label>${t("Bild (JPG, PNG oder WebP, max. 3 MB)")}<input class="input" type="file" name="file" accept="image/jpeg,image/png,image/webp"></label>
        <div class="form__actions">
          <button type="button" class="btn btn--ghost" data-modal-close>${t("Abbrechen")}</button>
          <button type="submit" class="btn btn--primary">${t("Speichern")}</button>
        </div>
      </form>`, {
      onOpen: (b) => $("#charForm", b).addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector("[type=submit]");
        const f = new FormData(form);
        const file = f.get("file");
        btn.disabled = true;
        try {
          if (file && file.size) {
            if (file.size > 3 * 1024 * 1024) throw new Error(t("Das Bild ist größer als 3 MB."));
            imageUrl = await store.upload(file);
          }
          await store.save({
            name: f.get("name").trim(),
            age: f.get("age") ? Number(f.get("age")) : null,
            job: f.get("job").trim() || null,
            faction: f.get("faction") || null,
            origin: f.get("origin").trim() || null,
            bio: f.get("bio").trim() || null,
            image_url: imageUrl || null,
          }, c.id);
          Modal.close();
          showToast(t("Gespeichert."));
          render();
        } catch (err) {
          btn.disabled = false;
          showToast(t("Fehler") + ": " + (err.message || err));
        }
      }),
    });
  }

  async function startNew() {
    if (!demo()) {
      await MavoAuth.ready;
      if (!MavoAuth.user) {
        if (confirm(t("Zum Vorstellen deines Charakters musst du dich mit Discord anmelden. Jetzt anmelden?"))) MavoAuth.login();
        return;
      }
    }
    showForm();
  }

  document.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-char]");
    if (card) { const c = list.find((x) => x.id === card.dataset.char) || profileChars.find((x) => x.id === card.dataset.char); if (c) showDetail(c); }
    if (e.target.closest("[data-char-new]")) startNew();
    const ed = e.target.closest("[data-char-edit]");
    if (ed) showForm(list.find((x) => x.id === ed.dataset.charEdit) || profileChars.find((x) => x.id === ed.dataset.charEdit));
    const del = e.target.closest("[data-char-del]");
    if (del && confirm(t("Charakter wirklich löschen?"))) {
      try { await store.remove(del.dataset.charDel); Modal.close(); showToast(t("Gelöscht.")); render(); } catch (err) { showToast(err.message); }
    }
  });

  /* ---------- Charaktere im Forum-Profil ---------- */
  let profileChars = [];
  window.renderProfileCharacters = async (userId, el) => {
    if (!el) return;
    try { profileChars = await store.byUser(userId); } catch { return; }
    if (!profileChars.length) return;
    el.innerHTML = `<h3 class="profile__title">${t("Charaktere")}</h3><div class="profile-chars">${profileChars.map(cardHtml).join("")}</div>`;
  };

  document.addEventListener("tabchange", (e) => { if (e.detail === "buerger") render(); });
  MavoAuth.onChange(() => { if (!$("#buerger").hidden) render(); });
  document.addEventListener("langchange", () => { if (loaded) render(); });
  if (!$("#buerger").hidden) render();
})();
