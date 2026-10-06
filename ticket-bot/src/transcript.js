const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function fetchAll(channel, limit = 3000) {
  const all = [];
  let before;
  while (all.length < limit) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
  }
  return all.reverse(); // chronologisch
}

const fmt = (d) =>
  new Date(d).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'medium' });

async function buildTranscript(channel, ticket, meta = {}) {
  const messages = await fetchAll(channel);

  const rows = messages
    .map((m) => {
      const text = esc(m.content).replace(/\n/g, '<br>');
      const files = [...m.attachments.values()]
        .map((a) => `<div class="att">📎 <a href="${esc(a.url)}">${esc(a.name)}</a></div>`)
        .join('');
      const embeds = m.embeds
        .map((e) => `<div class="embed">${e.title ? `<b>${esc(e.title)}</b><br>` : ''}${esc(e.description || '').replace(/\n/g, '<br>')}</div>`)
        .join('');
      return `<div class="msg">
  <img class="av" src="${esc(m.author.displayAvatarURL({ size: 64, extension: 'png' }))}" alt="">
  <div><span class="name">${esc(m.author.tag ?? m.author.username)}</span>
  <span class="time">${esc(fmt(m.createdTimestamp))}</span>
  <div class="txt">${text}</div>${files}${embeds}</div></div>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<title>Ticket #${ticket.number} – Transcript</title>
<style>
body{background:#313338;color:#dbdee1;font-family:system-ui,Segoe UI,sans-serif;margin:0;padding:24px}
h1{font-size:20px;margin:0 0 4px}.meta{color:#949ba4;font-size:13px;margin-bottom:20px}
.msg{display:flex;gap:12px;margin:10px 0}.av{width:40px;height:40px;border-radius:50%}
.name{font-weight:600;color:#fff}.time{color:#949ba4;font-size:12px;margin-left:6px}
.txt{margin-top:2px;line-height:1.4;word-break:break-word}.att a{color:#00a8fc}
.embed{border-left:4px solid #5865f2;background:#2b2d31;padding:8px 12px;margin-top:6px;border-radius:4px}
</style></head><body>
<h1>Ticket #${ticket.number}${meta.typeName ? ' · ' + esc(meta.typeName) : ''}</h1>
<div class="meta">Erstellt: ${esc(fmt(ticket.created_at))}${meta.closedBy ? ' · Geschlossen von: ' + esc(meta.closedBy) : ''}${meta.reason ? ' · Grund: ' + esc(meta.reason) : ''} · ${messages.length} Nachrichten</div>
${rows || '<i>Keine Nachrichten.</i>'}
</body></html>`;

  return Buffer.from(html, 'utf8');
}

module.exports = { buildTranscript };
