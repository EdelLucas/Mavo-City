/* ==========================================================
   Mavo City – Supabase-Verbindung & Discord-Login (gemeinsam
   für Forum, Admin-Bereich, Umfragen und Quiz)

   window.getSupabase()  -> Promise<Client | null>
   window.MavoAuth       -> { user, ready, login(), logout(), onChange(cb) }
   ========================================================== */
(() => {
  const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  const RETURN_KEY = "mavo_login_return";
  const enabled = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);

  let clientPromise;
  window.getSupabase = () => (clientPromise ||= (async () => {
    if (!enabled) return null;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SUPABASE_JS; s.onload = resolve; s.onerror = reject;
      document.head.append(s);
    });
    return window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
    });
  })().catch((err) => {
    console.error("Supabase nicht erreichbar – Demo-Modus", err);
    // Ganze Seite einheitlich im Demo-Modus weiterlaufen lassen
    if (window.MavoAuth) window.MavoAuth.enabled = false;
    return null;
  }));

  const listeners = new Set();
  const Auth = {
    enabled,
    user: null,          // { id, name, avatar, isAdmin }
    onChange(cb) { listeners.add(cb); },
    async login() {
      const sb = await getSupabase();
      if (!sb) return;
      // Rücksprung immer auf die Hauptseite (nur sie muss in Supabase als Redirect-URL eingetragen sein)
      const hash = location.hash.slice(1) || document.body.dataset.page || "";
      try { sessionStorage.setItem(RETURN_KEY, hash); } catch { /* egal */ }
      const home = new URL("./", document.baseURI);
      const { error } = await sb.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: document.body.classList.contains("admin-page") ? location.origin + location.pathname : home.href },
      });
      if (error) throw error;
    },
    async logout() {
      const sb = await getSupabase();
      if (sb) await sb.auth.signOut();
      Auth.user = null;
      listeners.forEach((cb) => cb(null));
    },
  };

  async function loadUser(sb, session) {
    if (!session?.user) { Auth.user = null; return; }
    const meta = session.user.user_metadata || {};
    let isAdmin = false;
    try {
      const { data } = await sb.rpc("is_forum_admin");
      isAdmin = !!data;
    } catch { /* kein Admin */ }
    // Profil (Name, Avatar) mit Discord abgleichen – benötigt supabase/update-3-forum-admin.sql
    sb.rpc("forum_touch_profile").then(() => {}, () => {});
    Auth.user = {
      id: session.user.id,
      name: meta.custom_claims?.global_name || meta.full_name || meta.name || "Unbekannt",
      avatar: meta.avatar_url || "",
      isAdmin,
    };
  }

  Auth.ready = (async () => {
    const sb = await getSupabase();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    await loadUser(sb, data.session);
    sb.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      // Nicht direkt im Callback awaiten (Supabase-Empfehlung)
      setTimeout(async () => {
        await loadUser(sb, session);
        listeners.forEach((cb) => cb(Auth.user));
      }, 0);
    });

    // Nach dem Discord-Login zur vorherigen Seite zurück
    let back = null;
    try { back = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); } catch { /* egal */ }
    if (back !== null && Auth.user) {
      const hash = back;
      if (hash && location.hash !== "#" + hash) {
        history.replaceState(null, "", "#" + hash);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      window.showToast?.(`Willkommen, ${Auth.user.name}!`);
    }
  })().catch((err) => console.error(err));

  window.MavoAuth = Auth;
})();
