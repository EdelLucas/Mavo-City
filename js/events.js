/* ==========================================================
   Mavo City – Events: Liste, Countdown, Kalender-Export (.ics)
   Zeiten in CONTENT.events sind deutsche Zeit (Europe/Berlin).
   ========================================================== */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const esc = window.escapeHtml;
  const TZ = "Europe/Berlin";

  // "2026-11-14T20:00" (Berliner Zeit) -> Date
  function berlinDate(str) {
    const [d, tm = "00:00"] = String(str).split("T");
    const [y, mo, da] = d.split("-").map(Number);
    const [h, mi] = tm.split(":").map(Number);
    const guess = Date.UTC(y, mo - 1, da, h, mi);
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const asBerlin = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    return new Date(guess - (asBerlin - guess));
  }

  const fmt = (date) => date.toLocaleString(getLang() === "en" ? "en-GB" : "de-DE", {
    timeZone: TZ, weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
  }) + (getLang() === "en" ? " (German time)" : " Uhr");

  function countdown(date) {
    let s = Math.max(0, Math.floor((date - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    const box = (v, l) => `<span class="cd__box"><strong>${String(v).padStart(2, "0")}</strong><small>${l}</small></span>`;
    return box(d, t("Tage")) + box(h, t("Std")) + box(m, t("Min")) + box(s, t("Sek"));
  }

  const sorted = () => CONTENT.events
    .map((e, i) => ({ ...e, i, at: berlinDate(e.date) }))
    .filter((e) => !isNaN(e.at))
    .sort((a, b) => a.at - b.at);

  // Event gilt 3 Stunden nach Beginn noch als "läuft"
  const isPast = (e) => e.at.getTime() + 3 * 3600_000 < Date.now();
  const isRunning = (e) => e.at <= Date.now() && !isPast(e);

  function card(e, big = false) {
    return `
      <article class="event ${isPast(e) ? "event--past" : ""} ${big ? "event--big" : ""}">
        <div class="event__date">
          <span class="event__day">${e.at.toLocaleDateString("de-DE", { timeZone: TZ, day: "2-digit" })}</span>
          <span class="event__month">${e.at.toLocaleDateString(getLang() === "en" ? "en-GB" : "de-DE", { timeZone: TZ, month: "short" })}</span>
        </div>
        <div class="event__body">
          ${e.type ? `<span class="tag">${esc(e.type)}</span>` : ""}
          ${isRunning(e) ? `<span class="tag tag--ok"><span class="dot is-online"></span> ${t("Läuft gerade")}</span>` : ""}
          <h3>${esc(e.title)}</h3>
          <p class="event__meta"><span>${icon("clock")} ${esc(fmt(e.at))}</span>${e.location ? `<span>${icon("pin")} ${esc(e.location)}</span>` : ""}</p>
          ${e.desc ? `<p>${esc(e.desc)}</p>` : ""}
          ${!isPast(e) && !isRunning(e) ? `<div class="cd" data-countdown="${e.at.getTime()}">${countdown(e.at)}</div>` : ""}
          ${!isPast(e) ? `
            <div class="event__actions">
              ${signupHtml(e)}
              <button class="btn btn--ghost btn--sm" data-ics="${e.i}">${icon("calendar")} ${t("In Kalender eintragen")}</button>
            </div>` : ""}
        </div>
      </article>`;
  }

  /* ---------- Anmeldung ("Ich bin dabei") ----------
     Mit Supabase: Tabelle event_signups, sonst nur lokal im Browser. */
  const LOCAL = "mavo_demo_signups";
  const keyOf = (e) => `${String(e.date).slice(0, 16)}-${String(e.title).toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").slice(0, 100)}`;
  let signups = {}; // key -> [{ user_id, user_name, user_avatar }]

  function signupHtml(e) {
    const key = keyOf(e);
    const list = signups[key] || [];
    const uid = MavoAuth.enabled ? MavoAuth.user?.id : "demo";
    const joined = list.some((s) => s.user_id === uid);
    const faces = list.slice(0, 5).map((s) => s.user_avatar
      ? `<img src="${esc(s.user_avatar)}" alt="" title="${esc(s.user_name)}" loading="lazy">`
      : `<span title="${esc(s.user_name)}">${esc((s.user_name || "?")[0])}</span>`).join("");
    return `
      <button class="btn btn--sm ${joined ? "btn--ghost is-joined" : "btn--primary"}" data-signup="${esc(key)}" aria-pressed="${joined}">
        ${icon(joined ? "check-circle" : "plus")} ${joined ? t("Du bist dabei") : t("Ich bin dabei")}
      </button>
      ${list.length ? `<span class="event__signup"><span class="avatars">${faces}</span><span class="signup-count">${t("{n} dabei", { n: list.length })}</span></span>` : ""}`;
  }

  async function loadSignups() {
    const keys = sorted().filter((e) => !isPast(e)).map(keyOf);
    if (!keys.length) return;
    await getSupabase();
    if (!MavoAuth.enabled) {
      try { signups = JSON.parse(localStorage.getItem(LOCAL)) || {}; } catch { signups = {}; }
      return;
    }
    const sb = await getSupabase();
    if (!sb) return;
    const { data, error } = await sb.from("event_signups").select("event_key, user_id, user_name, user_avatar").in("event_key", keys);
    if (error) return;
    signups = {};
    data.forEach((s) => (signups[s.event_key] ||= []).push(s));
  }

  async function toggleSignup(key) {
    const list = signups[key] || [];
    await getSupabase();
    if (!MavoAuth.enabled) {
      const i = list.findIndex((s) => s.user_id === "demo");
      if (i >= 0) list.splice(i, 1); else list.push({ user_id: "demo", user_name: t("Du") });
      signups[key] = list;
      try { localStorage.setItem(LOCAL, JSON.stringify(signups)); } catch { /* egal */ }
      return render();
    }
    await MavoAuth.ready;
    if (!MavoAuth.user) {
      if (confirm(t("Zum Anmelden musst du dich mit Discord einloggen. Jetzt einloggen?"))) MavoAuth.login();
      return;
    }
    const sb = await getSupabase();
    const joined = list.some((s) => s.user_id === MavoAuth.user.id);
    const { error } = joined
      ? await sb.from("event_signups").delete().eq("event_key", key).eq("user_id", MavoAuth.user.id)
      : await sb.from("event_signups").insert({ event_key: key });
    if (error) return showToast(t("Fehler") + ": " + error.message);
    showToast(joined ? t("Abgemeldet.") : t("Angemeldet – bis dann!"));
    await loadSignups();
    render();
  }

  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-signup]");
    if (b) { b.disabled = true; toggleSignup(b.dataset.signup).finally(() => (b.disabled = false)); }
  });

  function render() {
    const list = sorted();
    const upcoming = list.filter((e) => !isPast(e));
    const past = list.filter(isPast).reverse().slice(0, 5);

    $("#eventsList").innerHTML = upcoming.length || past.length
      ? `<div class="events">${upcoming.map((e) => card(e)).join("")}</div>
         ${past.length ? `<h2 class="section__title events__past-title">${t("Vergangene Events")}</h2><div class="events">${past.map((e) => card(e)).join("")}</div>` : ""}`
      : `<div class="empty">${t("Aktuell sind keine Events geplant.")}</div>`;

    $("#nextEvent").innerHTML = upcoming.length
      ? card(upcoming[0], true) + `<a class="more-link" href="#events">${t("Alle Events ansehen")} ${icon("arrow-right")}</a>`
      : `<div class="empty">${t("Aktuell sind keine Events geplant.")}</div>`;
  }

  // Countdown jede Sekunde aktualisieren
  setInterval(() => {
    document.querySelectorAll("[data-countdown]").forEach((el) => {
      const at = new Date(Number(el.dataset.countdown));
      if (at <= Date.now()) return render();
      el.innerHTML = countdown(at);
    });
  }, 1000);

  /* ---------- Kalender-Datei (.ics) ---------- */
  const icsDate = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const icsText = (s) => String(s ?? "").replace(/[\\,;]/g, (c) => "\\" + c).replace(/\n/g, "\\n");

  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-ics]");
    if (!btn) return;
    const e = sorted().find((x) => x.i === Number(btn.dataset.ics));
    const end = new Date(e.at.getTime() + 2 * 3600_000);
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mavo City//Events//DE", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:mavocity-${e.at.getTime()}-${e.i}@mavocity.com`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(e.at)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsText("Mavo City: " + e.title)}`,
      `DESCRIPTION:${icsText(e.desc || "")}`,
      `LOCATION:${icsText(e.location || "Mavo City")}`,
      // Erinnerung 30 Minuten vorher
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText("Mavo City: " + e.title)}`, "TRIGGER:-PT30M", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = `${e.title.replace(/[^\wäöüß -]/gi, "").trim() || "event"}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  contentReady.then(async () => { render(); await loadSignups(); render(); });
  MavoAuth.onChange(async () => { await loadSignups(); render(); });
  document.addEventListener("langchange", render);
})();
