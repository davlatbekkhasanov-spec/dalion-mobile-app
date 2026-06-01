/**
 * Eski bot sozlamalarini tozalash (@ai_davlat_agent_pro_bot).
 * Webhook o'chiriladi, navbatdagi update lar yopiladi, yangi buyruqlar qo'yiladi.
 *
 *   cd face-id-bot && cp .env.example .env  (token to'ldiring)
 *   npm run reset-bot
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '.env');

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error('.env topilmadi. .env.example dan nusxa oling.');
    process.exit(1);
  }
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}

const TG = (token) => `https://api.telegram.org/bot${token}`;

async function api(token, method, body = {}) {
  const res = await fetch(`${TG(token)}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description || res.status}`);
  return data.result;
}

async function drainUpdates(token) {
  let offset = 0;
  for (let n = 0; n < 20; n++) {
    const res = await fetch(`${TG(token)}/getUpdates?offset=${offset}&timeout=1`);
    const data = await res.json();
    if (!data.ok || !data.result?.length) break;
    for (const u of data.result) offset = u.update_id + 1;
  }
  if (offset) console.log('Eski update lar yopildi, offset:', offset);
}

async function main() {
  loadEnv();
  const token = String(process.env.AI_DAVLAT_BOT_TOKEN || '').trim();
  if (!token) {
    console.error('AI_DAVLAT_BOT_TOKEN .env da kerak');
    process.exit(1);
  }

  console.log('Webhook o\'chirilmoqda...');
  await api(token, 'deleteWebhook', { drop_pending_updates: true });

  console.log('Eski xabarlar/navbat tozalanmoqda...');
  await drainUpdates(token);

  const commands = [
    { command: 'start', description: 'Yordam' },
    { command: 'kuzat', description: 'Xodim tanlash' },
    { command: 'rozxat', description: 'Kuzatiladigan xodimlar' },
    { command: 'hodimlar', description: 'Bugun terminalda kim bor' },
    { command: 'bugun', description: 'Bugungi keldi/ketdi' },
    { command: 'hozir', description: 'Hozir ichkarida kim' }
  ];

  console.log('Yangi buyruqlar (faqat Face ID)...');
  await api(token, 'setMyCommands', { commands });

  await api(token, 'setMyDescription', {
    description:
      'Face ID davomat: tanlangan xodimlar keldi/ketdi va ish vaqti. GlobusMarket dan alohida.'
  });
  await api(token, 'setMyShortDescription', {
    short_description: 'Hikvision Face ID davomat boti'
  });

  console.log('Tayyor. Endi: npm start');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
