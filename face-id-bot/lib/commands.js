const { summarizeDay, whoIsIn, formatClock, formatDuration } = require('./attendance.js');
const {
  listWatched,
  listKnownToday,
  addWatchByQuery,
  removeWatch,
  addWatch,
  watchlistCount,
  isWatchedEmpKey
} = require('./watchlist.js');
const { pickEmployeeKeyboard } = require('./telegram.js');

const HELP_TEXT = `🤖 @ai_davlat_agent_pro_bot
Face ID davomat (GlobusMarket dan alohida)

Faqat tanlangan xodimlar uchun xabar.

/kuzat — xodim tanlash
/qosh Ism — qo'shish
/olib Ism — olib tashlash
/rozxat — kim kuzatiladi
/hodimlar — bugun terminalda ko'ringanlar
/bugun — keldi/ketdi
/hozir — ichkarida kim bor
/soat — oxirgi ish vaqti`;

function watchedEmpKeys(state) {
  const keys = new Set();
  for (const row of listWatched(state)) {
    if (!row.key.startsWith('env:')) keys.add(row.key);
  }
  return keys;
}

function isAllowed(chatId, allowedChatIds) {
  if (!allowedChatIds.length) return true;
  return allowedChatIds.includes(String(chatId));
}

function formatRozxat(state) {
  const rows = listWatched(state);
  if (!rows.length) {
    return "📋 Hech kim tanlanmagan.\n/kuzat yoki /qosh Ali\n\n.env: FACE_TRACK_EMPLOYEES=Ali,Vali";
  }
  return `📋 Kuzatiladi (${rows.length}):\n${rows.map((r, i) => `${i + 1}. ${r.name}`).join('\n')}`;
}

function formatHodimlar(state, dateKey) {
  const known = listKnownToday(state, dateKey);
  if (!known.length) return "Bugun Face ID hodisasi yo'q.";
  const lines = known.map((k) => {
    const on = isWatchedEmpKey(state, k.key);
    return `${on ? '✅' : '⚪'} ${k.name}`;
  });
  return `👥 Bugun terminalda:\n\n${lines.join('\n')}\n\n/kuzat — tanlash`;
}

function handleCommand(text, state, dateKey) {
  const parts = (text || '').trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ').trim();
  const wKeys = watchedEmpKeys(state);

  if (cmd === '/start' || cmd === '/help' || cmd === '/yordam') {
    return { text: HELP_TEXT };
  }
  if (cmd === '/rozxat' || cmd === '/royxat') {
    return { text: formatRozxat(state) };
  }
  if (cmd === '/hodimlar') {
    return { text: formatHodimlar(state, dateKey) };
  }
  if (cmd === '/kuzat' || cmd === '/tanla') {
    const known = listKnownToday(state, dateKey);
    const watchedSet = new Set(
      listWatched(state)
        .filter((w) => !w.key.startsWith('env:'))
        .map((w) => w.key)
    );
    return {
      text: '👇 Kuzatish uchun bosing:',
      reply_markup: pickEmployeeKeyboard(known, watchedSet)
    };
  }
  if (cmd === '/qosh') {
    return { text: addWatchByQuery(state, dateKey, arg).message };
  }
  if (cmd === '/olib' || cmd === '/ochir') {
    return { text: removeWatch(state, arg, dateKey).message };
  }
  if (cmd === '/bugun') {
    if (!watchlistCount(state)) return { text: 'Avval /kuzat bilan xodim tanlang.' };
    return { text: `📅 ${dateKey}\n\n${summarizeDay(state, dateKey, wKeys)}` };
  }
  if (cmd === '/hozir') {
    if (!watchlistCount(state)) return { text: 'Avval /kuzat bilan xodim tanlang.' };
    return { text: whoIsIn(state, dateKey, wKeys) };
  }
  if (cmd === '/soat') {
    if (!watchlistCount(state)) return { text: 'Avval /kuzat bilan xodim tanlang.' };
    let latest = null;
    for (const [emp, days] of Object.entries(state.staff || {})) {
      if (!wKeys.has(emp)) continue;
      const row = days[dateKey];
      if (!row?.checkIn || !row?.checkOut) continue;
      const out = new Date(row.checkOut).getTime();
      if (!latest || out > latest.out) latest = { row, out };
    }
    if (!latest) return { text: "Bugun to'liq ketish yo'q." };
    const ms = new Date(latest.row.checkOut) - new Date(latest.row.checkIn);
    return {
      text:
        `⏱ ${latest.row.name}\n` +
        `📥 ${formatClock(new Date(latest.row.checkIn))}\n` +
        `📤 ${formatClock(new Date(latest.row.checkOut))}\n` +
        `Jami: ${formatDuration(ms)}`
    };
  }
  return null;
}

function handleCallback(data, state, dateKey) {
  const wKeys = watchedEmpKeys(state);

  if (data === 'noop') return { text: '—' };
  if (data === 'cmd:bugun') {
    if (!watchlistCount(state)) return { text: 'Avval /kuzat' };
    return { text: summarizeDay(state, dateKey, wKeys) };
  }
  if (data === 'cmd:rozxat') return { text: formatRozxat(state) };
  if (data.startsWith('wadd|')) {
    const emp = data.slice(5);
    const known = state.knownStaff?.[dateKey]?.[emp];
    addWatch(state, emp, known?.name || emp);
    return { text: `✅ ${known?.name || emp}` };
  }
  if (data.startsWith('wdel|')) {
    const emp = data.slice(5);
    const name = state.watchlist?.[emp]?.name || emp;
    if (state.watchlist) delete state.watchlist[emp];
    return { text: `⛔ ${name}` };
  }
  if (data.startsWith('hrs|')) {
    const [, emp, dk = dateKey] = data.split('|');
    const row = state.staff?.[emp]?.[dk];
    if (!row?.checkIn || !row?.checkOut) return { text: "Ma'lumot yo'q." };
    const ms = new Date(row.checkOut) - new Date(row.checkIn);
    return {
      text:
        `👤 ${row.name}\n` +
        `📥 ${formatClock(new Date(row.checkIn))}\n` +
        `📤 ${formatClock(new Date(row.checkOut))}\n` +
        `⏱ ${formatDuration(ms)}`
    };
  }
  return null;
}

module.exports = { HELP_TEXT, isAllowed, handleCommand, handleCallback, watchedEmpKeys };
