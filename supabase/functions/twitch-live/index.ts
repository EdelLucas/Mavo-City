// ==========================================================
// Mavo City – Supabase Edge Function "twitch-live"
// Prüft, welche Twitch-Kanäle gerade live sind.
//
// Aufruf:  GET /functions/v1/twitch-live?channels=name1,name2
// Antwort: { live: { name1: { title, viewers, game, thumbnail } } }
//
// Secrets (Supabase → Edge Functions → Secrets):
//   TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
//   (von https://dev.twitch.tv/console/apps → "Anwendung registrieren")
// ==========================================================

const CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("TWITCH_CLIENT_SECRET") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

let token: { value: string; expires: number } | null = null;
const cache = new Map<string, { at: number; body: string }>();
const CACHE_MS = 60_000;

async function getToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`Twitch-Token fehlgeschlagen (${res.status})`);
  const data = await res.json();
  token = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return token.value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET fehlen");

    const channels = (new URL(req.url).searchParams.get("channels") ?? "")
      .split(",").map((c) => c.trim().toLowerCase()).filter((c) => /^[a-z0-9_]{3,25}$/.test(c)).slice(0, 100);
    const key = channels.sort().join(",");

    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      return new Response(hit.body, { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const live: Record<string, unknown> = {};
    if (channels.length) {
      const qs = channels.map((c) => `user_login=${encodeURIComponent(c)}`).join("&");
      const res = await fetch(`https://api.twitch.tv/helix/streams?${qs}`, {
        headers: { "Client-Id": CLIENT_ID, Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error(`Twitch-API Fehler (${res.status})`);
      const { data } = await res.json();
      for (const s of data) {
        live[s.user_login] = {
          title: s.title,
          viewers: s.viewer_count,
          game: s.game_name,
          thumbnail: s.thumbnail_url.replace("{width}", "640").replace("{height}", "360"),
        };
      }
    }

    const body = JSON.stringify({ live });
    cache.set(key, { at: Date.now(), body });
    return new Response(body, { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
