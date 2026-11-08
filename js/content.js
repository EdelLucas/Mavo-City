/* ==========================================================
   Mavo City – Inhalte laden
   Standard sind die Daten aus js/data.js. Wenn Supabase eingerichtet
   ist, werden Inhalte, die im Admin-Bereich gespeichert wurden,
   aus der Tabelle "site_content" geladen und ersetzen die Standards.

   window.CONTENT        -> aktuelle Inhalte
   window.contentReady   -> Promise, erfüllt sobald geladen
   ========================================================== */
(() => {
  window.CONTENT_DEFAULTS = {
    news: NEWS,
    team: TEAM,
    factions: FACTIONS,
    gallery: GALLERY,
    changelog: CHANGELOG,
    packages: DONATION_PACKAGES,
    events: EVENTS,
    wiki: WIKI,
    streamers: STREAMERS,
    map: MAP_LOCATIONS,
    quiz: QUIZ,
    hero: HERO_IMAGES.map((src) => ({ src })),
  };

  window.CONTENT = { ...CONTENT_DEFAULTS };

  window.contentReady = (async () => {
    const sb = await getSupabase();
    if (!sb) return;
    const { data, error } = await sb.from("site_content").select("key, data");
    if (error) throw error;
    data.forEach((row) => {
      if (row.key in CONTENT && Array.isArray(row.data)) CONTENT[row.key] = row.data;
    });
  })().catch((err) => console.error("Inhalte konnten nicht geladen werden – nutze Standard", err));
})();
