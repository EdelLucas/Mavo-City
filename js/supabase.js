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
      try { sessionStorage.setItem(RETURN_KEY, location.pathname + location.hash); } catch { /* egal */ }
      const { error } = await sb.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: location.origin + location.pathname },
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
    if (back && Auth.user) {
      const [path, hash = ""] = back.split("#");
      if (path === location.pathname && hash && location.hash !== "#" + hash) {
        history.replaceState(null, "", "#" + hash);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      window.showToast?.(`Willkommen, ${Auth.user.name}!`);
    }
  })().catch((err) => console.error(err));

  window.MavoAuth = Auth;
})();
