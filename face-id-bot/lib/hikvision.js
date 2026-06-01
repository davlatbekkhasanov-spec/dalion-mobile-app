const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const MINOR_LABELS = {
  75: 'Yuz (ruxsat)',
  38: 'Karta / ruxsat',
  9: 'Kirish',
  6: 'Chiqish',
  7: 'Chiqish',
  22: 'Ketish',
  23: 'Kelish'
};

const CHECKOUT_MINORS = new Set([6, 7, 22]);

function todayRange(tz) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    startTime: `${y}-${m}-${d}T00:00:00${tz}`,
    endTime: `${y}-${m}-${d}T23:59:59${tz}`,
    dateKey: `${y}-${m}-${d}`
  };
}

function labelMinor(minor) {
  const n = Number(minor);
  return MINOR_LABELS[n] || `Hodisa (${minor})`;
}

function isCheckout(ev) {
  return CHECKOUT_MINORS.has(Number(ev.minor));
}

function employeeKey(ev) {
  const emp = String(ev.employeeNoString || ev.employeeNo || '').trim();
  const name = String(ev.name || '').trim();
  return emp || name || 'unknown';
}

function displayName(ev) {
  return (
    String(ev.name || '').trim() ||
    String(ev.employeeNoString || ev.employeeNo || '').trim() ||
    "Noma'lum"
  );
}

function parseEventTime(ev) {
  const raw = String(ev.time || '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function curlDigestJson(curlBin, url, user, password, bodyObj) {
  const body = JSON.stringify(bodyObj);
  const { stdout, stderr } = await execFileAsync(
    curlBin,
    [
      '-s',
      '-m',
      '25',
      '--digest',
      '-u',
      `${user}:${password}`,
      '-H',
      'Content-Type: application/json',
      '-d',
      body,
      url
    ],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
  );
  const raw = (stdout || stderr || '').trim();
  if (!raw || raw.startsWith('<!DOCTYPE') || raw.includes('Unauthorized')) {
    throw new Error("Qurilma: 401 yoki noto'g'ri javob (parol/IP)");
  }
  return JSON.parse(raw);
}

async function fetchTodayEvents(config) {
  const { startTime, endTime, dateKey } = todayRange(config.tz);
  const url = `http://${config.ip}/ISAPI/AccessControl/AcsEvent?format=json`;
  const payload = {
    AcsEventCond: {
      searchID: String(Date.now()),
      searchResultPosition: 0,
      maxResults: 50,
      major: 0,
      minor: 0,
      startTime,
      endTime,
      timeReverseOrder: false
    }
  };
  const data = await curlDigestJson(
    config.curlBin,
    url,
    config.user,
    config.password,
    payload
  );
  const list = data?.AcsEvent?.InfoList;
  const events = !list ? [] : Array.isArray(list) ? list : [list];
  return { events, dateKey };
}

function eventDedupeKey(ev) {
  const serial = ev.serialNo ?? ev.serialno ?? '';
  const time = ev.time ?? '';
  const emp = employeeKey(ev);
  const minor = ev.minor ?? '';
  if (serial) return `s:${serial}`;
  return `t:${time}|e:${emp}|m:${minor}`;
}

module.exports = {
  fetchTodayEvents,
  eventDedupeKey,
  isCheckout,
  employeeKey,
  displayName,
  parseEventTime,
  labelMinor,
  todayRange
};
