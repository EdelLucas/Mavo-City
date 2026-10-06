require('dotenv').config();

const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'CLIENT_SECRET', 'BASE_URL', 'SESSION_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌ Fehlende Werte in der .env: ${missing.join(', ')}\n   Kopiere .env.example nach .env und fülle sie aus.`);
  process.exit(1);
}
process.env.BASE_URL = process.env.BASE_URL.replace(/\/+$/, '');

const bot = require('./bot');
const dashboard = require('./dashboard');

process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));

dashboard.start();
bot.start().catch((e) => {
  console.error('❌ Bot-Login fehlgeschlagen:', e.message);
  process.exit(1);
});
