const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.face-bot');

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return;
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function cfg() {
  loadEnvFile();
  const ip = String(process.env.FACE_DEVICE_IP || '192.168.110.50').trim();
  const user = String(process.env.FACE_DEVICE_USER || 'admin').trim();
  const password = String(process.env.FACE_DEVICE_PASSWORD || '').trim();
  const token = String(
    process.env.SKLAD_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ''
  ).trim();
  const chatId = String(
    process.env.SKLAD_NOTIFY_CHAT_ID || process.env.TELEGRAM_CHAT_ID || ''
  ).trim();
  const pollSec = Math.max(15, Number(process.env.POLL_INTERVAL_SEC || 25) || 25);
  const tz = String(process.env.FACE_TIMEZONE || '+05:00').trim();
  const allowedRaw = String(process.env.TELEGRAM_ALLOWED_CHAT_IDS || chatId).trim();
  const allowedChatIds = allowedRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const trackEmployees = String(process.env.FACE_TRACK_EMPLOYEES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!password) throw new Error('FACE_DEVICE_PASSWORD .env.face-bot da kerak');
  if (!token) throw new Error('SKLAD_BOT_TOKEN (@sklad_nazoratchi_bot) kerak');
  if (!chatId) throw new Error('SKLAD_NOTIFY_CHAT_ID kerak');

  return {
    ip,
    user,
    password,
    token,
    chatId,
    pollSec,
    tz,
    allowedChatIds,
    trackEmployees,
    curlBin: process.platform === 'win32' ? 'curl.exe' : 'curl',
    stateFile: path.join(ROOT, '.state.json')
  };
}

module.exports = { cfg, loadEnvFile, ROOT };
