const {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType, PermissionFlagsBits, MessageFlags, AttachmentBuilder,
  SlashCommandBuilder, Events, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const db = require('./db');
const { buildTranscript } = require('./transcript');

const intents = [GatewayIntentBits.Guilds];
if (process.env.MESSAGE_CONTENT_INTENT === 'true') {
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
}
const client = new Client({ intents });

const EPHEMERAL = MessageFlags.Ephemeral;
const STYLES = { Primary: ButtonStyle.Primary, Secondary: ButtonStyle.Secondary, Success: ButtonStyle.Success, Danger: ButtonStyle.Danger };
const colorInt = (hex) => parseInt(String(hex || '#5865F2').replace('#', ''), 16) || 0x5865f2;

/* ---------- Hilfsfunktionen ---------- */

function isStaff(member, type, settings) {
  if (!member) return false;
  const perms = member.permissions;
  if (perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageGuild)) return true;
  const roleIds = new Set([...(settings.support_role_ids || []), ...(type?.support_role_ids || [])]);
  const memberRoles = member.roles?.cache ?? new Map();
  return [...roleIds].some((id) => memberRoles.has(id));
}

function fill(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function channelName(format, vars) {
  const raw = fill(format || 'ticket-{number}', vars)
    .toLowerCase()
    .replace(/[^a-z0-9\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (raw || `ticket-${vars.number}`).slice(0, 90);
}

function ticketButtons(settings, claimedBy) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );
  if (settings.claim_enabled) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:claim')
        .setLabel(claimedBy ? 'Übernommen' : 'Übernehmen')
        .setEmoji('🙋')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!!claimedBy)
    );
  }
  return [row];
}

const reply = (i, content) => {
  const payload = { content, flags: EPHEMERAL };
  return i.deferred || i.replied ? i.followUp(payload) : i.reply(payload);
};

/* ---------- Panels ---------- */

function panelPayload(panel, types) {
  const embed = new EmbedBuilder()
    .setColor(colorInt(panel.color))
    .setTitle(panel.title || 'Support')
    .setDescription(panel.description || 'Klicke unten, um ein Ticket zu öffnen.');
  if (panel.footer) embed.setFooter({ text: panel.footer });
  if (panel.image_url) embed.setImage(panel.image_url);

  let components;
  if (panel.style === 'select') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket:select')
      .setPlaceholder('Wähle eine Kategorie …')
      .addOptions(
        types.slice(0, 25).map((t) => {
          const o = { label: t.name.slice(0, 100), value: String(t.id) };
          if (t.description) o.description = t.description.slice(0, 100);
          if (t.emoji) o.emoji = t.emoji;
          return o;
        })
      );
    components = [new ActionRowBuilder().addComponents(menu)];
  } else {
    components = [];
    for (let i = 0; i < Math.min(types.length, 25); i += 5) {
      const row = new ActionRowBuilder();
      for (const t of types.slice(i, i + 5)) {
        const b = new ButtonBuilder()
          .setCustomId(`ticket:open:${t.id}`)
          .setLabel(t.name.slice(0, 80))
          .setStyle(STYLES[t.button_style] ?? ButtonStyle.Primary);
        if (t.emoji) b.setEmoji(t.emoji);
        row.addComponents(b);
      }
      components.push(row);
    }
  }
  return { embeds: [embed], components };
}

function userError(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}

async function sendPanel(panel) {
  const guild = client.guilds.cache.get(panel.guild_id);
  if (!guild) throw userError('Der Bot ist nicht auf diesem Server.');
  const channel = guild.channels.cache.get(panel.channel_id);
  if (!channel || channel.type !== ChannelType.GuildText) throw userError('Der Ziel-Kanal wurde nicht gefunden.');

  const types = panel.type_ids.map((id) => db.getType(id)).filter((t) => t && t.guild_id === panel.guild_id);
  if (!types.length) throw userError('Wähle mindestens einen Ticket-Typ für das Panel.');

  const payload = panelPayload(panel, types);
  let message = null;
  if (panel.message_id) {
    try {
      message = await channel.messages.fetch(panel.message_id);
      await message.edit(payload);
    } catch {
      message = null;
    }
  }
  if (!message) message = await channel.send(payload);
  db.setPanelMessage(panel.id, message.id);
  return message.id;
}

async function deletePanelMessage(panel) {
  if (!panel.message_id) return;
  try {
    const guild = client.guilds.cache.get(panel.guild_id);
    const channel = guild?.channels.cache.get(panel.channel_id);
    const msg = await channel?.messages.fetch(panel.message_id);
    await msg?.delete();
  } catch { /* Nachricht existiert evtl. nicht mehr */ }
}

/* ---------- Tickets ---------- */

// Prüft Blacklist, Rollenpflicht und Limits. Gibt eine Fehlermeldung zurück oder null.
function checkAccess(i, type, settings) {
  const guild = i.guild;
  if ((settings.blacklist_user_ids || []).includes(i.user.id)) {
    return '❌ Du kannst auf diesem Server keine Tickets erstellen.';
  }
  if (type.required_role_id && !i.member?.roles?.cache?.has(type.required_role_id)) {
    return `❌ Für diese Kategorie brauchst du die Rolle <@&${type.required_role_id}>.`;
  }

  // Verwaiste Tickets (Kanal manuell gelöscht) bereinigen
  const alive = [];
  for (const t of db.openTicketsOfUser(guild.id, i.user.id)) {
    if (guild.channels.cache.has(t.channel_id)) alive.push(t);
    else db.markClosed(t.id, null, 'Kanal wurde gelöscht');
  }
  if (alive.length >= settings.max_tickets_per_user) {
    return `❌ Du hast bereits ${alive.length} offene(s) Ticket(s): <#${alive[0].channel_id}>`;
  }
  if (type.max_tickets_per_user > 0) {
    const ofType = alive.filter((t) => t.type_id === type.id);
    if (ofType.length >= type.max_tickets_per_user) {
      return `❌ Du hast bereits ein offenes Ticket in dieser Kategorie: <#${ofType[0].channel_id}>`;
    }
  }
  return null;
}

function buildModal(type) {
  const modal = new ModalBuilder().setCustomId(`ticket:modal:${type.id}`).setTitle(type.name.slice(0, 45));
  type.questions.slice(0, 5).forEach((q, idx) => {
    const input = new TextInputBuilder()
      .setCustomId(`q${idx}`)
      .setLabel(q.label.slice(0, 45))
      .setStyle(q.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(!!q.required)
      .setMaxLength(q.long ? 1000 : 200);
    if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100));
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  });
  return modal;
}

// Einstieg über Button oder Auswahlmenü: prüfen, ggf. Formular zeigen, sonst direkt erstellen
async function startTicket(i, typeId) {
  const settings = db.getSettings(i.guild.id);
  const type = db.getType(typeId);
  if (!type || type.guild_id !== i.guild.id) return reply(i, '❌ Diese Ticket-Kategorie existiert nicht mehr.');
  const problem = checkAccess(i, type, settings);
  if (problem) return reply(i, problem);
  if (type.questions.length) return i.showModal(buildModal(type));
  return createTicket(i, type.id);
}

async function onModal(i) {
  const [ns, action, arg] = i.customId.split(':');
  if (ns !== 'ticket' || action !== 'modal') return;
  const type = db.getType(Number(arg));
  if (!type || type.guild_id !== i.guild.id) return reply(i, '❌ Diese Ticket-Kategorie existiert nicht mehr.');
  const answers = type.questions.slice(0, 5)
    .map((q, idx) => ({ label: q.label, value: i.fields.fields.get(`q${idx}`)?.value?.trim() }))
    .filter((a) => a.value);
  return createTicket(i, type.id, answers);
}

async function createTicket(i, typeId, answers = []) {
  const guild = i.guild;
  const settings = db.getSettings(guild.id);
  const type = db.getType(typeId);
  if (!type || type.guild_id !== guild.id) return reply(i, '❌ Diese Ticket-Kategorie existiert nicht mehr.');

  const problem = checkAccess(i, type, settings);
  if (problem) return reply(i, problem);

  await i.deferReply({ flags: EPHEMERAL });

  const { id: ticketId, number } = db.reserveTicket(guild.id, i.user.id, type.id);
  try {
    const supportRoles = [...new Set([...settings.support_role_ids, ...type.support_role_ids])].filter((r) => guild.roles.cache.has(r));
    const allow = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];

    const parent = type.category_id && guild.channels.cache.get(type.category_id)?.type === ChannelType.GuildCategory ? type.category_id : undefined;

    const channel = await guild.channels.create({
      name: channelName(type.name_format || settings.name_format, {
        number: String(number).padStart(4, '0'),
        user: i.user.username,
        type: type.name,
      }),
      type: ChannelType.GuildText,
      parent,
      topic: `Ticket #${number} (${type.name}) von ${i.user.tag} | ID: ${i.user.id}`,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: i.user.id, allow },
        { id: client.user.id, allow: [...allow, PermissionFlagsBits.ManageChannels] },
        ...supportRoles.map((id) => ({ id, allow })),
      ],
    });
    db.setTicketChannel(ticketId, channel.id);

    const vars = { user: `<@${i.user.id}>`, username: i.user.username, type: type.name, number: String(number) };
    const embed = new EmbedBuilder()
      .setColor(colorInt(settings.embed_color))
      .setTitle(`${type.emoji ? type.emoji + ' ' : ''}${type.name} · Ticket #${number}`)
      .setDescription(fill(type.welcome_message || settings.welcome_message, vars).slice(0, 4000));
    if (answers.length) {
      embed.addFields(answers.map((a) => ({ name: a.label.slice(0, 256), value: a.value.slice(0, 1024) })));
    }

    const pings = [`<@${i.user.id}>`];
    if (settings.ping_support) pings.push(...supportRoles.map((r) => `<@&${r}>`));

    await channel.send({
      content: pings.join(' '),
      embeds: [embed],
      components: ticketButtons(settings, null),
      allowedMentions: { users: [i.user.id], roles: settings.ping_support ? supportRoles : [] },
    });

    await i.editReply({ content: `✅ Dein Ticket wurde erstellt: ${channel}` });
    await sendLog(guild, settings, new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Ticket geöffnet')
      .addFields(
        { name: 'Ticket', value: `#${number} · ${channel}`, inline: true },
        { name: 'Kategorie', value: type.name, inline: true },
        { name: 'Von', value: `<@${i.user.id}>`, inline: true }
      )
      .setTimestamp());
  } catch (err) {
    console.error('Ticket-Erstellung fehlgeschlagen:', err);
    db.deleteTicketRow(ticketId);
    await i.editReply({
      content: '❌ Ticket konnte nicht erstellt werden. Prüfe, ob der Bot die Rechte „Kanäle verwalten“ und „Rollen verwalten“ hat und die Kategorie nicht voll ist (max. 50 Kanäle).',
    });
  }
}

async function sendLog(guild, settings, embed, files = []) {
  if (!settings.log_channel_id) return;
  const ch = guild.channels.cache.get(settings.log_channel_id);
  if (!ch || ch.type !== ChannelType.GuildText) return;
  try {
    await ch.send({ embeds: [embed], files });
  } catch (e) {
    console.error('Log konnte nicht gesendet werden:', e.message);
  }
}

async function closeTicket(channel, ticket, closer, reason) {
  const guild = channel.guild;
  const settings = db.getSettings(guild.id);
  const type = ticket.type_id ? db.getType(ticket.type_id) : null;

  db.markClosed(ticket.id, closer.id, reason);

  let transcript = null;
  try {
    transcript = await buildTranscript(channel, ticket, {
      typeName: type?.name,
      closedBy: closer.tag ?? closer.username,
      reason,
    });
  } catch (e) {
    console.error('Transcript fehlgeschlagen:', e.message);
  }
  const fileName = `transcript-${ticket.number}.html`;
  const file = () => (transcript ? [new AttachmentBuilder(transcript, { name: fileName })] : []);

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('Ticket geschlossen')
    .addFields(
      { name: 'Ticket', value: `#${ticket.number}${type ? ' · ' + type.name : ''}`, inline: true },
      { name: 'Erstellt von', value: `<@${ticket.user_id}>`, inline: true },
      { name: 'Geschlossen von', value: `<@${closer.id}>`, inline: true },
      ...(ticket.claimed_by ? [{ name: 'Übernommen von', value: `<@${ticket.claimed_by}>`, inline: true }] : []),
      ...(reason ? [{ name: 'Grund', value: reason.slice(0, 1000) }] : [])
    )
    .setTimestamp();

  await sendLog(guild, settings, embed, file());

  if (settings.dm_transcript) {
    try {
      const user = await client.users.fetch(ticket.user_id);
      await user.send({
        content: `Dein Ticket **#${ticket.number}** auf **${guild.name}** wurde geschlossen.${reason ? `\nGrund: ${reason}` : ''}`,
        files: file(),
      });
    } catch { /* DMs deaktiviert */ }
  }

  const delay = Math.max(0, Math.min(60, Number(settings.delete_delay) || 0));
  await channel.send(`🔒 Ticket wird geschlossen. Dieser Kanal wird in ${delay} Sekunden gelöscht.`).catch(() => {});
  setTimeout(() => channel.delete('Ticket geschlossen').catch(() => {}), delay * 1000);
}

/* ---------- Interaktionen ---------- */

async function onButton(i) {
  const [ns, action, arg] = i.customId.split(':');
  if (ns !== 'ticket') return;

  if (action === 'open') return startTicket(i, Number(arg));

  const ticket = db.getTicketByChannel(i.channelId);
  if (!ticket || ticket.status !== 'open') return reply(i, '❌ Das ist kein offenes Ticket.');
  const settings = db.getSettings(i.guild.id);
  const type = ticket.type_id ? db.getType(ticket.type_id) : null;
  const staff = isStaff(i.member, type, settings);

  if (action === 'claim') {
    if (!staff) return reply(i, '❌ Nur das Support-Team kann Tickets übernehmen.');
    if (!db.claimTicket(ticket.id, i.user.id)) return reply(i, '❌ Dieses Ticket wurde bereits übernommen.');
    await i.update({ components: ticketButtons(settings, i.user.id) });
    return i.channel.send({ content: `🙋 ${i.user} hat das Ticket übernommen.`, allowedMentions: { parse: [] } });
  }

  if (action === 'close') {
    const owner = ticket.user_id === i.user.id;
    if (!staff && !(owner && settings.allow_user_close)) return reply(i, '❌ Du darfst dieses Ticket nicht schließen.');
    if (settings.close_confirm) {
      return i.reply({
        content: 'Möchtest du dieses Ticket wirklich schließen?',
        flags: EPHEMERAL,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket:closeconfirm').setLabel('Ja, schließen').setStyle(ButtonStyle.Danger)
        )],
      });
    }
    await i.deferUpdate();
    return closeTicket(i.channel, ticket, i.user, null);
  }

  if (action === 'closeconfirm') {
    const owner = ticket.user_id === i.user.id;
    if (!staff && !(owner && settings.allow_user_close)) return reply(i, '❌ Du darfst dieses Ticket nicht schließen.');
    await i.update({ content: '🔒 Ticket wird geschlossen …', components: [] });
    return closeTicket(i.channel, ticket, i.user, null);
  }
}

async function onSelect(i) {
  if (i.customId !== 'ticket:select') return;
  await startTicket(i, Number(i.values[0]));
  // Auswahl im Panel zurücksetzen, damit dieselbe Kategorie erneut wählbar ist
  i.message.edit({ components: i.message.components }).catch(() => {});
}

const commandDefs = [
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket-Verwaltung (im Ticket-Kanal)')
    .setDMPermission(false)
    .addSubcommand((s) => s.setName('add').setDescription('Nutzer zum Ticket hinzufügen').addUserOption((o) => o.setName('user').setDescription('Nutzer').setRequired(true)))
    .addSubcommand((s) => s.setName('remove').setDescription('Nutzer aus dem Ticket entfernen').addUserOption((o) => o.setName('user').setDescription('Nutzer').setRequired(true)))
    .addSubcommand((s) => s.setName('rename').setDescription('Ticket umbenennen').addStringOption((o) => o.setName('name').setDescription('Neuer Name').setRequired(true).setMaxLength(90)))
    .addSubcommand((s) => s.setName('close').setDescription('Ticket schließen').addStringOption((o) => o.setName('reason').setDescription('Grund').setMaxLength(500))),
  new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Link zum Ticket-Dashboard')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());

async function onCommand(i) {
  if (i.commandName === 'dashboard') {
    return i.reply({ content: `🔧 Dashboard: ${process.env.BASE_URL}/dashboard#/g/${i.guild.id}`, flags: EPHEMERAL });
  }
  if (i.commandName !== 'ticket') return;

  const ticket = db.getTicketByChannel(i.channelId);
  if (!ticket || ticket.status !== 'open') return reply(i, '❌ Dieser Befehl funktioniert nur in einem offenen Ticket.');
  const settings = db.getSettings(i.guild.id);
  const type = ticket.type_id ? db.getType(ticket.type_id) : null;
  if (!isStaff(i.member, type, settings)) return reply(i, '❌ Nur das Support-Team darf diesen Befehl nutzen.');

  const sub = i.options.getSubcommand();
  if (sub === 'add') {
    const user = i.options.getUser('user');
    await i.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
    return i.reply({ content: `✅ ${user} wurde zum Ticket hinzugefügt.`, allowedMentions: { users: [user.id] } });
  }
  if (sub === 'remove') {
    const user = i.options.getUser('user');
    if (user.id === ticket.user_id) return reply(i, '❌ Der Ticket-Ersteller kann nicht entfernt werden.');
    await i.channel.permissionOverwrites.delete(user.id);
    return i.reply({ content: `✅ ${user} wurde aus dem Ticket entfernt.`, allowedMentions: { parse: [] } });
  }
  if (sub === 'rename') {
    const name = channelName(i.options.getString('name'), { number: ticket.number });
    await i.channel.setName(name);
    return reply(i, `✅ Ticket umbenannt in **${name}**.`);
  }
  if (sub === 'close') {
    await i.reply({ content: '🔒 Ticket wird geschlossen …', flags: EPHEMERAL });
    return closeTicket(i.channel, ticket, i.user, i.options.getString('reason'));
  }
}

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.guild) return;
    if (i.isChatInputCommand()) return await onCommand(i);
    if (i.isButton()) return await onButton(i);
    if (i.isStringSelectMenu()) return await onSelect(i);
    if (i.isModalSubmit()) return await onModal(i);
  } catch (err) {
    console.error('Interaktionsfehler:', err);
    try { await reply(i, '❌ Es ist ein Fehler aufgetreten.'); } catch { /* ignorieren */ }
  }
});

// Kanal manuell gelöscht -> Ticket als geschlossen markieren
client.on(Events.ChannelDelete, (channel) => {
  const t = db.getTicketByChannel(channel.id);
  if (t && t.status === 'open') db.markClosed(t.id, null, 'Kanal wurde gelöscht');
});

async function registerCommands(guild) {
  try {
    await guild.commands.set(commandDefs);
  } catch (e) {
    console.error(`Commands für ${guild.name} konnten nicht registriert werden:`, e.message);
  }
}

// Schließt ein Ticket von außen (Dashboard). Fehlt der Kanal, wird es nur als geschlossen markiert.
async function closeTicketById(ticket, closer, reason) {
  const guild = client.guilds.cache.get(ticket.guild_id);
  const channel = guild?.channels.cache.get(ticket.channel_id);
  if (!channel) {
    db.markClosed(ticket.id, closer.id, reason || 'Kanal wurde gelöscht');
    return;
  }
  await closeTicket(channel, ticket, closer, reason);
}

// Auto-Close: schließt Tickets ohne Nachricht seit X Stunden
let sweeping = false;
async function sweepInactive() {
  if (sweeping) return;
  sweeping = true;
  try {
    for (const guild of client.guilds.cache.values()) {
      const hours = Number(db.getSettings(guild.id).auto_close_hours) || 0;
      if (!hours) continue;
      for (const t of db.listOpenTickets(guild.id)) {
        const channel = guild.channels.cache.get(t.channel_id);
        if (!channel) continue;
        try {
          const last = (await channel.messages.fetch({ limit: 1 })).first();
          const lastActivity = last ? last.createdTimestamp : t.created_at;
          if (Date.now() - lastActivity > hours * 3600 * 1000) {
            await closeTicket(channel, t, client.user, `Automatisch geschlossen (${hours} Std. ohne Aktivität)`);
          }
        } catch (e) {
          console.error(`Auto-Close für Ticket #${t.number} fehlgeschlagen:`, e.message);
        }
      }
    }
  } finally {
    sweeping = false;
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Bot online als ${c.user.tag} (${c.guilds.cache.size} Server)`);
  for (const guild of c.guilds.cache.values()) await registerCommands(guild);
  setInterval(sweepInactive, 10 * 60 * 1000);
});
client.on(Events.GuildCreate, registerCommands);

function start() {
  return client.login(process.env.DISCORD_TOKEN);
}

module.exports = { client, start, sendPanel, deletePanelMessage, closeTicketById, panelPayload, channelName, buildModal };
