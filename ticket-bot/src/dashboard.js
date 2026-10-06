const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const { ChannelType, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const db = require('./db');
const bot = require('./bot');

const API = 'https://discord.com/api/v10';
const HEX = /^#[0-9a-fA-F]{6}$/;
const CUSTOM_EMOJI = /^<a?:\w{2,32}:\d{15,25}>$/;
const UNICODE_EMOJI = /^\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️|\p{Emoji_Modifier})*$/u;

const httpError = (status, message) => Object.assign(new Error(message), { status });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const str = (v, max, { required = false, label = 'Feld' } = {}) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw httpError(400, `${label} darf nicht leer sein.`);
  if (s.length > max) throw httpError(400, `${label} ist zu lang (max. ${max} Zeichen).`);
  return s || null;
};

function start() {
  const { CLIENT_ID, CLIENT_SECRET, BASE_URL, SESSION_SECRET, PORT = 3000 } = process.env;
  const redirectUri = `${BASE_URL}/callback`;
  const app = express();

  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(
    session({
      name: 'ticketdash.sid',
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 7 * 24 * 3600 * 1000 },
    })
  );

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
    });
    next();
  });

  /* ---------- Discord OAuth2 ---------- */

  app.get('/login', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
      prompt: 'none',
    });
    req.session.save(() => res.redirect(`https://discord.com/oauth2/authorize?${params}`));
  });

  app.get('/callback', wrap(async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state || state !== req.session.oauthState) return res.status(400).send('Ungültige Anfrage. <a href="/login">Erneut anmelden</a>');

    const tokenRes = await fetch(`${API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) return res.status(400).send('Anmeldung fehlgeschlagen. <a href="/login">Erneut versuchen</a>');
    const { access_token } = await tokenRes.json();
    const headers = { Authorization: `Bearer ${access_token}` };
    const [user, guilds] = await Promise.all([
      fetch(`${API}/users/@me`, { headers }).then((r) => r.json()),
      fetch(`${API}/users/@me/guilds`, { headers }).then((r) => r.json()),
    ]);
    if (!user.id || !Array.isArray(guilds)) return res.status(502).send('Discord-Antwort ungültig.');

    req.session.regenerate((err) => {
      if (err) return res.status(500).send('Sitzungsfehler');
      req.session.user = { id: user.id, username: user.global_name || user.username, avatar: user.avatar };
      req.session.guilds = guilds.map((g) => ({ id: g.id, name: g.name, icon: g.icon, owner: g.owner, permissions: g.permissions }));
      req.session.save(() => res.redirect('/dashboard'));
    });
  }));

  app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

  /* ---------- Öffentliche Daten für die Startseite ---------- */

  const invitePerms = new PermissionsBitField([
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
  ]).bitfield.toString();
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot%20applications.commands&permissions=${invitePerms}`;

  app.get('/api/public', (req, res) => {
    res.json({
      inviteUrl,
      servers: bot.client.guilds.cache.size,
      botName: bot.client.user?.username || 'Ticket Bot',
      loggedIn: !!req.session.user,
    });
  });

  /* ---------- API-Schutz ---------- */

  const canManage = (g) =>
    g.owner || (BigInt(g.permissions) & (PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild)) !== 0n;

  app.use('/api', (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Nicht angemeldet.' });
    // CSRF-Schutz: schreibende Requests müssen JSON sein (Cross-Site-Formulare können das nicht)
    if (!['GET', 'HEAD'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ error: 'Content-Type muss application/json sein.' });
    }
    next();
  });

  app.get('/api/me', (req, res) => {
    const guilds = (req.session.guilds || []).filter(canManage).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      botIn: bot.client.guilds.cache.has(g.id),
    }));
    res.json({ user: req.session.user, guilds, inviteUrl });
  });

  // Alle /api/guilds/:gid/* Routen: Berechtigung + Bot auf Server prüfen
  app.use('/api/guilds/:gid', (req, res, next) => {
    const g = (req.session.guilds || []).find((x) => x.id === req.params.gid);
    if (!g || !canManage(g)) return res.status(403).json({ error: 'Keine Berechtigung für diesen Server.' });
    const guild = bot.client.guilds.cache.get(req.params.gid);
    if (!guild) return res.status(404).json({ error: 'Der Bot ist nicht auf diesem Server.' });
    req.guild = guild;
    next();
  });

  /* ---------- Validierung ---------- */

  const roleIds = (guild, v) => {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map(String))].filter((id) => id !== guild.id && guild.roles.cache.has(id)).slice(0, 25);
  };
  const textChannelId = (guild, v, label) => {
    if (!v) return null;
    const c = guild.channels.cache.get(String(v));
    if (!c || c.type !== ChannelType.GuildText) throw httpError(400, `${label}: Kanal nicht gefunden.`);
    return c.id;
  };
  const categoryId = (guild, v) => {
    if (!v) return null;
    const c = guild.channels.cache.get(String(v));
    if (!c || c.type !== ChannelType.GuildCategory) throw httpError(400, 'Discord-Kategorie nicht gefunden.');
    return c.id;
  };
  const color = (v) => {
    if (!HEX.test(v || '')) throw httpError(400, 'Ungültige Farbe.');
    return v;
  };
  const intIn = (v, min, max, label) => {
    const n = Number(v ?? 0);
    if (!Number.isInteger(n) || n < min || n > max) throw httpError(400, `${label}: Zahl von ${min} bis ${max}.`);
    return n;
  };
  const roleOne = (guild, v) => {
    if (!v) return null;
    const id = String(v);
    if (id === guild.id || !guild.roles.cache.has(id)) throw httpError(400, 'Rolle nicht gefunden.');
    return id;
  };
  const parseQuestions = (v) => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((q) => q && typeof q.label === 'string' && q.label.trim())
      .slice(0, 5)
      .map((q) => ({
        label: str(q.label, 45, { required: true, label: 'Frage' }),
        placeholder: str(q.placeholder, 100) || '',
        required: !!q.required,
        long: !!q.long,
      }));
  };
  const imageUrl = (v) => {
    const s = str(v, 500);
    if (!s) return null;
    try {
      const u = new URL(s);
      if (u.protocol !== 'https:') throw new Error('x');
      return u.href;
    } catch {
      throw httpError(400, 'Bild-URL muss mit https:// beginnen.');
    }
  };
  const emoji = (v) => {
    const s = str(v, 64);
    if (!s) return null;
    if (!CUSTOM_EMOJI.test(s) && !UNICODE_EMOJI.test(s)) throw httpError(400, 'Ungültiges Emoji (ein Standard-Emoji oder <:name:id>).');
    return s;
  };

  /* ---------- Server-Daten ---------- */

  // Ticket-Zeilen fürs Frontend aufbereiten (Nutzernamen auflösen, Typnamen einsetzen)
  const formatTickets = async (guildId, rows) => {
    const types = Object.fromEntries(db.listTypes(guildId).map((t) => [t.id, t.name]));
    const names = {};
    await Promise.all(
      [...new Set(rows.map((t) => t.user_id))].map(async (id) => {
        try { names[id] = (await bot.client.users.fetch(id)).username; } catch { names[id] = id; }
      })
    );
    return rows.map((t) => ({
      id: t.id,
      number: t.number,
      status: t.status,
      user: names[t.user_id],
      user_id: t.user_id,
      type: types[t.type_id] || 'Gelöschte Kategorie',
      channel_id: t.channel_id,
      claimed_by: t.claimed_by,
      created_at: t.created_at,
      closed_at: t.closed_at,
      close_reason: t.close_reason,
    }));
  };

  app.get('/api/guilds/:gid', wrap(async (req, res) => {
    const g = req.guild;
    const channels = [...g.channels.cache.values()];
    const recent = await formatTickets(g.id, db.listTicketsPage(g.id, { limit: 6 }).rows);
    res.json({
      guild: { id: g.id, name: g.name },
      textChannels: channels.filter((c) => c.type === ChannelType.GuildText).sort((a, b) => a.rawPosition - b.rawPosition).map((c) => ({ id: c.id, name: c.name })),
      categories: channels.filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.rawPosition - b.rawPosition).map((c) => ({ id: c.id, name: c.name })),
      roles: [...g.roles.cache.values()]
        .filter((r) => r.id !== g.id && !r.managed)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor })),
      settings: db.getSettings(g.id),
      types: db.listTypes(g.id),
      panels: db.listPanels(g.id),
      stats: db.ticketStats(g.id),
      typeStats: db.typeStats(g.id),
      daily: db.dailyStats(g.id, 14),
      recent,
    });
  }));

  /* ---------- Einstellungen ---------- */

  app.put('/api/guilds/:gid/settings', (req, res) => {
    const b = req.body || {};
    const g = req.guild;
    const max = Number(b.max_tickets_per_user);
    const delay = Number(b.delete_delay);
    if (!Number.isInteger(max) || max < 1 || max > 10) throw httpError(400, 'Max. Tickets pro Nutzer: 1–10.');
    if (!Number.isInteger(delay) || delay < 0 || delay > 60) throw httpError(400, 'Lösch-Verzögerung: 0–60 Sekunden.');
    const autoClose = intIn(b.auto_close_hours, 0, 720, 'Auto-Close (Stunden)');
    const blacklist = [...new Set((Array.isArray(b.blacklist_user_ids) ? b.blacklist_user_ids : []).map(String))]
      .filter((id) => /^\d{15,25}$/.test(id))
      .slice(0, 200);
    const saved = db.saveSettings(g.id, {
      log_channel_id: textChannelId(g, b.log_channel_id, 'Log-Kanal'),
      support_role_ids: roleIds(g, b.support_role_ids),
      max_tickets_per_user: max,
      name_format: str(b.name_format, 60, { required: true, label: 'Kanal-Name' }),
      welcome_message: str(b.welcome_message, 1500, { required: true, label: 'Willkommensnachricht' }),
      embed_color: color(b.embed_color),
      claim_enabled: !!b.claim_enabled,
      close_confirm: !!b.close_confirm,
      allow_user_close: !!b.allow_user_close,
      dm_transcript: !!b.dm_transcript,
      ping_support: !!b.ping_support,
      delete_delay: delay,
      auto_close_hours: autoClose,
      blacklist_user_ids: blacklist,
    });
    res.json(saved);
  });

  /* ---------- Ticket-Typen ---------- */

  const parseType = (g, b) => ({
    name: str(b.name, 80, { required: true, label: 'Name' }),
    emoji: emoji(b.emoji),
    description: str(b.description, 100),
    button_style: ['Primary', 'Secondary', 'Success', 'Danger'].includes(b.button_style) ? b.button_style : 'Primary',
    category_id: categoryId(g, b.category_id),
    support_role_ids: roleIds(g, b.support_role_ids),
    welcome_message: str(b.welcome_message, 1500),
    name_format: str(b.name_format, 60),
    max_tickets_per_user: intIn(b.max_tickets_per_user, 0, 10, 'Limit pro Kategorie'),
    required_role_id: roleOne(g, b.required_role_id),
    questions: parseQuestions(b.questions),
  });

  const ownType = (req) => {
    const t = db.getType(Number(req.params.id));
    if (!t || t.guild_id !== req.guild.id) throw httpError(404, 'Typ nicht gefunden.');
    return t;
  };

  app.post('/api/guilds/:gid/types', (req, res) => {
    if (db.listTypes(req.guild.id).length >= 25) throw httpError(400, 'Maximal 25 Ticket-Typen.');
    res.json(db.createType(req.guild.id, parseType(req.guild, req.body || {})));
  });

  app.put('/api/guilds/:gid/types/:id', (req, res) => {
    const t = ownType(req);
    res.json(db.updateType(t.id, parseType(req.guild, req.body || {})));
  });

  app.delete('/api/guilds/:gid/types/:id', (req, res) => {
    db.deleteType(ownType(req).id);
    res.json({ ok: true });
  });

  /* ---------- Panels ---------- */

  const parsePanel = (g, b) => ({
    channel_id: textChannelId(g, b.channel_id, 'Panel-Kanal') || (() => { throw httpError(400, 'Wähle einen Kanal für das Panel.'); })(),
    title: str(b.title, 256, { required: true, label: 'Titel' }),
    description: str(b.description, 2000),
    footer: str(b.footer, 200),
    color: color(b.color),
    image_url: imageUrl(b.image_url),
    style: b.style === 'select' ? 'select' : 'buttons',
    type_ids: (Array.isArray(b.type_ids) ? b.type_ids : [])
      .map(Number)
      .filter((id) => { const t = db.getType(id); return t && t.guild_id === g.id; })
      .slice(0, 25),
  });

  const ownPanel = (req) => {
    const p = db.getPanel(Number(req.params.id));
    if (!p || p.guild_id !== req.guild.id) throw httpError(404, 'Panel nicht gefunden.');
    return p;
  };

  // Discord-Fehler in verständliche Meldungen übersetzen
  const discordError = (e) => {
    if (e.status === 400 && e.message) return e;
    if (e.code === 50013 || e.code === 50001) return httpError(400, 'Dem Bot fehlen Rechte im Ziel-Kanal (Kanal sehen, Nachrichten senden, Links einbetten).');
    if (e.code === 50035) return httpError(400, 'Discord hat das Panel abgelehnt (z. B. ungültiges Emoji oder zu lange Texte).');
    return e;
  };

  app.post('/api/guilds/:gid/panels', wrap(async (req, res) => {
    const panel = db.createPanel(req.guild.id, parsePanel(req.guild, req.body || {}));
    try {
      await bot.sendPanel(panel);
    } catch (e) {
      db.deletePanel(panel.id);
      throw discordError(e);
    }
    res.json(db.getPanel(panel.id));
  }));

  app.put('/api/guilds/:gid/panels/:id', wrap(async (req, res) => {
    const old = ownPanel(req);
    const data = parsePanel(req.guild, req.body || {});
    if (old.channel_id !== data.channel_id) {
      await bot.deletePanelMessage(old);
      db.setPanelMessage(old.id, null);
    }
    const panel = db.updatePanel(old.id, data);
    try {
      await bot.sendPanel(panel);
    } catch (e) {
      throw discordError(e);
    }
    res.json(db.getPanel(panel.id));
  }));

  app.delete('/api/guilds/:gid/panels/:id', wrap(async (req, res) => {
    const p = ownPanel(req);
    await bot.deletePanelMessage(p);
    db.deletePanel(p.id);
    res.json({ ok: true });
  }));

  /* ---------- Tickets ---------- */

  const PAGE_SIZE = 20;

  app.get('/api/guilds/:gid/tickets', wrap(async (req, res) => {
    const status = ['open', 'closed'].includes(req.query.status) ? req.query.status : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 25) : '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const { rows, total } = db.listTicketsPage(req.guild.id, { status, q, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
    res.json({
      rows: await formatTickets(req.guild.id, rows),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  }));

  // Ticket aus dem Dashboard heraus schließen
  app.post('/api/guilds/:gid/tickets/:id/close', wrap(async (req, res) => {
    const t = db.getTicketById(Number(req.params.id));
    if (!t || t.guild_id !== req.guild.id) throw httpError(404, 'Ticket nicht gefunden.');
    if (t.status !== 'open') throw httpError(400, 'Dieses Ticket ist bereits geschlossen.');
    const reason = str((req.body || {}).reason, 500);
    const user = req.session.user;
    await bot.closeTicketById(t, { id: user.id, username: user.username }, reason);
    res.json({ ok: true });
  }));

  /* ---------- Frontend ---------- */

  // extensions: /dashboard liefert dashboard.html aus
  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

  // Fehlerbehandlung
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (!err.status || err.status >= 500) console.error(err);
    const status = err.status || 500;
    res.status(status).json({ error: status < 500 ? err.message : 'Interner Serverfehler.' });
  });

  app.listen(PORT, () => console.log(`🌐 Dashboard läuft auf ${BASE_URL} (Port ${PORT})`));
}

module.exports = { start };
