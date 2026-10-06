// Eingebautes SQLite von Node.js (ab Node 22.13) – nichts zu kompilieren, keine Zusatzpakete.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(path.join(dir, 'tickets.db'));
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  guild_id TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT,
  description TEXT,
  button_style TEXT NOT NULL DEFAULT 'Primary',
  category_id TEXT,
  support_role_ids TEXT NOT NULL DEFAULT '[]',
  welcome_message TEXT
);
CREATE TABLE IF NOT EXISTS panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  title TEXT,
  description TEXT,
  footer TEXT,
  color TEXT,
  style TEXT NOT NULL DEFAULT 'buttons',
  type_ids TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  channel_id TEXT UNIQUE,
  user_id TEXT NOT NULL,
  type_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  claimed_by TEXT,
  created_at INTEGER NOT NULL,
  closed_at INTEGER,
  closed_by TEXT,
  close_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_types_guild ON types(guild_id);
CREATE INDEX IF NOT EXISTS idx_panels_guild ON panels(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(guild_id, user_id, status);
`);

// Migration: neue Spalten zu bestehenden Datenbanken hinzufügen (Daten bleiben erhalten)
function addColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumn('types', 'name_format', 'TEXT');
addColumn('types', 'max_tickets_per_user', 'INTEGER NOT NULL DEFAULT 0');
addColumn('types', 'required_role_id', 'TEXT');
addColumn('types', 'questions', "TEXT NOT NULL DEFAULT '[]'");
addColumn('panels', 'image_url', 'TEXT');

const parseJson = (s, fallback) => {
  try { return JSON.parse(s); } catch { return fallback; }
};

/* ---------- Einstellungen ---------- */

const DEFAULTS = {
  log_channel_id: null,
  support_role_ids: [],
  max_tickets_per_user: 1,
  name_format: 'ticket-{number}',
  welcome_message: 'Hallo {user}! Bitte beschreibe dein Anliegen, das Team meldet sich gleich bei dir.',
  embed_color: '#5865F2',
  claim_enabled: true,
  close_confirm: true,
  allow_user_close: true,
  dm_transcript: true,
  ping_support: true,
  delete_delay: 5,
  auto_close_hours: 0,
  blacklist_user_ids: [],
};

function getSettings(guildId) {
  const row = db.prepare('SELECT data FROM settings WHERE guild_id = ?').get(guildId);
  return { ...DEFAULTS, ...(row ? parseJson(row.data, {}) : {}) };
}

function saveSettings(guildId, data) {
  const merged = { ...getSettings(guildId), ...data };
  db.prepare(
    `INSERT INTO settings (guild_id, data) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET data = excluded.data`
  ).run(guildId, JSON.stringify(merged));
  return merged;
}

/* ---------- Ticket-Typen ---------- */

const hydrateType = (r) =>
  r && { ...r, support_role_ids: parseJson(r.support_role_ids, []), questions: parseJson(r.questions, []) };

const listTypes = (guildId) =>
  db.prepare('SELECT * FROM types WHERE guild_id = ? ORDER BY id').all(guildId).map(hydrateType);

const getType = (id) => hydrateType(db.prepare('SELECT * FROM types WHERE id = ?').get(id));

function createType(guildId, t) {
  const info = db
    .prepare(
      `INSERT INTO types (guild_id, name, emoji, description, button_style, category_id, support_role_ids, welcome_message,
                          name_format, max_tickets_per_user, required_role_id, questions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      guildId, t.name, t.emoji, t.description, t.button_style, t.category_id, JSON.stringify(t.support_role_ids), t.welcome_message,
      t.name_format ?? null, t.max_tickets_per_user ?? 0, t.required_role_id ?? null, JSON.stringify(t.questions ?? [])
    );
  return getType(info.lastInsertRowid);
}

function updateType(id, t) {
  db.prepare(
    `UPDATE types SET name = ?, emoji = ?, description = ?, button_style = ?, category_id = ?,
     support_role_ids = ?, welcome_message = ?, name_format = ?, max_tickets_per_user = ?,
     required_role_id = ?, questions = ? WHERE id = ?`
  ).run(
    t.name, t.emoji, t.description, t.button_style, t.category_id, JSON.stringify(t.support_role_ids), t.welcome_message,
    t.name_format ?? null, t.max_tickets_per_user ?? 0, t.required_role_id ?? null, JSON.stringify(t.questions ?? []), id
  );
  return getType(id);
}

function deleteType(id) {
  db.prepare('DELETE FROM types WHERE id = ?').run(id);
  // aus Panels entfernen
  const panels = db.prepare('SELECT id, type_ids FROM panels').all();
  for (const p of panels) {
    const ids = parseJson(p.type_ids, []);
    if (ids.includes(id)) {
      db.prepare('UPDATE panels SET type_ids = ? WHERE id = ?').run(JSON.stringify(ids.filter((x) => x !== id)), p.id);
    }
  }
}

/* ---------- Panels ---------- */

const hydratePanel = (r) => r && { ...r, type_ids: parseJson(r.type_ids, []) };

const listPanels = (guildId) =>
  db.prepare('SELECT * FROM panels WHERE guild_id = ? ORDER BY id').all(guildId).map(hydratePanel);

const getPanel = (id) => hydratePanel(db.prepare('SELECT * FROM panels WHERE id = ?').get(id));

function createPanel(guildId, p) {
  const info = db
    .prepare(
      `INSERT INTO panels (guild_id, channel_id, title, description, footer, color, style, type_ids, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(guildId, p.channel_id, p.title, p.description, p.footer, p.color, p.style, JSON.stringify(p.type_ids), p.image_url ?? null);
  return getPanel(info.lastInsertRowid);
}

function updatePanel(id, p) {
  db.prepare(
    `UPDATE panels SET channel_id = ?, title = ?, description = ?, footer = ?, color = ?, style = ?, type_ids = ?,
     image_url = ? WHERE id = ?`
  ).run(p.channel_id, p.title, p.description, p.footer, p.color, p.style, JSON.stringify(p.type_ids), p.image_url ?? null, id);
  return getPanel(id);
}

const setPanelMessage = (id, messageId) =>
  db.prepare('UPDATE panels SET message_id = ? WHERE id = ?').run(messageId, id);

const deletePanel = (id) => db.prepare('DELETE FROM panels WHERE id = ?').run(id);

/* ---------- Tickets ---------- */

// Reserviert die nächste Ticket-Nummer atomar (Kanal-ID folgt danach).
function reserveTicket(guildId, userId, typeId) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const { n } = db.prepare('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM tickets WHERE guild_id = ?').get(guildId);
    const info = db
      .prepare('INSERT INTO tickets (guild_id, number, user_id, type_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(guildId, n, userId, typeId, Date.now());
    db.exec('COMMIT');
    return { id: Number(info.lastInsertRowid), number: Number(n) };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

const setTicketChannel = (id, channelId) =>
  db.prepare('UPDATE tickets SET channel_id = ? WHERE id = ?').run(channelId, id);

const deleteTicketRow = (id) => db.prepare('DELETE FROM tickets WHERE id = ?').run(id);

const getTicketByChannel = (channelId) =>
  db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);

const openTicketsOfUser = (guildId, userId) =>
  db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open' AND channel_id IS NOT NULL").all(guildId, userId);

const claimTicket = (id, userId) =>
  db.prepare('UPDATE tickets SET claimed_by = ? WHERE id = ? AND claimed_by IS NULL').run(userId, id).changes > 0;

const markClosed = (id, closedBy, reason) =>
  db.prepare("UPDATE tickets SET status = 'closed', closed_at = ?, closed_by = ?, close_reason = ? WHERE id = ?")
    .run(Date.now(), closedBy, reason || null, id);

const getTicketById = (id) => db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);

const listOpenTickets = (guildId) =>
  db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND status = 'open' AND channel_id IS NOT NULL").all(guildId);

// Gefilterte, seitenweise Ticket-Liste fürs Dashboard
function listTicketsPage(guildId, { status, q, limit = 25, offset = 0 } = {}) {
  const where = ['guild_id = ?', 'channel_id IS NOT NULL'];
  const args = [guildId];
  if (status === 'open' || status === 'closed') {
    where.push('status = ?');
    args.push(status);
  }
  if (q && /^\d+$/.test(q)) {
    where.push('(number = ? OR user_id = ?)');
    args.push(Number(q), q);
  }
  const w = where.join(' AND ');
  const total = Number(db.prepare(`SELECT COUNT(*) AS c FROM tickets WHERE ${w}`).get(...args).c);
  const rows = db.prepare(`SELECT * FROM tickets WHERE ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
  return { rows, total };
}

const ticketStats = (guildId) => {
  const r = db.prepare(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(status = 'open'), 0) AS open,
            COALESCE(SUM(status = 'closed'), 0) AS closed
     FROM tickets WHERE guild_id = ? AND channel_id IS NOT NULL`
  ).get(guildId);
  return { total: Number(r.total), open: Number(r.open), closed: Number(r.closed) };
};

// { "<typeId>": { total, open } } – "null" steht für gelöschte Typen
function typeStats(guildId) {
  const rows = db.prepare(
    `SELECT type_id, COUNT(*) AS total, COALESCE(SUM(status = 'open'), 0) AS open
     FROM tickets WHERE guild_id = ? AND channel_id IS NOT NULL GROUP BY type_id`
  ).all(guildId);
  return Object.fromEntries(rows.map((r) => [String(r.type_id), { total: Number(r.total), open: Number(r.open) }]));
}

// Tickets pro Tag (UTC) der letzten `days` Tage, fehlende Tage mit 0 aufgefüllt
function dailyStats(guildId, days = 14) {
  const since = Date.now() - days * 86400000;
  const rows = db.prepare(
    `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, COUNT(*) AS count
     FROM tickets WHERE guild_id = ? AND channel_id IS NOT NULL AND created_at >= ? GROUP BY day`
  ).all(guildId, since);
  const map = Object.fromEntries(rows.map((r) => [r.day, Number(r.count)]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    out.push({ day, count: map[day] || 0 });
  }
  return out;
}

module.exports = {
  getSettings, saveSettings, DEFAULTS,
  listTypes, getType, createType, updateType, deleteType,
  listPanels, getPanel, createPanel, updatePanel, setPanelMessage, deletePanel,
  reserveTicket, setTicketChannel, deleteTicketRow, getTicketByChannel, getTicketById, openTicketsOfUser,
  claimTicket, markClosed, listOpenTickets, listTicketsPage, ticketStats, typeStats, dailyStats,
};
