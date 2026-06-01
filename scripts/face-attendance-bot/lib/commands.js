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

const HELP_TEXT = `🏭 Sklad nazoratchi bot

📌 Faqat SIZ tanlagan xodimlar uchun xabar keladi.

Buyruqlar:
/start — yordam
/kuzat — xodim tanlash (tugmalar)
/qosh Ism — kuzatishga qo'shish
/olib Ism — kuzatishdan olib tashlash
/rozxat — kimlar kuzatiladi
/hodimlar — bugun Face ID da ko'ringanlar
/bugun — bugungi keldi/ketdi (faqat tanlanganlar)
/hozir — ichkarida kim bor
/soat — oxirgi ketgan ish vaqti

Ketganda ⏱ tugma — necha soat ishlagan.`;

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
    return (
      "📋 Kuzatiladigan xodim yo'q.\n\n" +
      '/kuzat — tugma bilan tanlang\n' +
      'yoki /qosh Ali\n\n' +
      ".env da FACE_TRACK_EMPLOYEES=Ali,Vali ham bo'lishi mumkin."
    );
  }
  return `📋 Kuzatiladi (${rows.length}):\n${rows.map((r, i) => `${i + 1}. ${r.name}`).join('\n')}`;
}

function formatHodimlar(state, dateKey) {
  const known = listKnownToday(state, dateKey);
  const watched = listWatched(state);
  const watchedNames = new Set(watched.map((w) => w.name.toLowerCase()));

  if (!known.length) {
    return "Bugun Face ID dan hali hodisa kelmagan (yoki terminal ulanmagan).";
  }

  const lines = known.map((k) => {
    const on = isWatchedEmpKey(state, k.key) || watchedNames.has(k.name.toLowerCase());
    return `${on ? '✅' : '⚪'} ${k.name} (${k.key})`;
  });
  return `👥 Bugun terminalda (${known.length}):\n\n${lines.join('\n')}\n\n/kuzat — tanlash`;
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
      text: '👇 Kuzatish uchun bosing (✅ = allaqachon kuzatiladi):',
      reply_markup: pickEmployeeKeyboard(known, watchedSet)
    };
  }
  if (cmd === '/qosh' || cmd === '/qoş') {
    const r = addWatchByQuery(state, dateKey, arg);
    return { text: r.message };
  }
  if (cmd === '/olib' || cmd === '/ochir') {
    const r = removeWatch(state, arg, dateKey);
    return { text: r.message };
  }
  if (cmd === '/bugun') {
    if (!watchlistCount(state)) {
      return { text: "Avval /kuzat yoki /qosh bilan xodim tanlang." };
    }
    return {
      text: `📅 Bugun (${dateKey})\n\n${summarizeDay(state, dateKey, wKeys)}`
    };
  }
  if (cmd === '/hozir') {
    if (!watchlistCount(state)) {
      return { text: "Avval /kuzat bilan xodim tanlang." };
    }
    return { text: `👥 ${whoIsIn(state, dateKey, wKeys)}` };
  }
  if (cmd === '/soat') {
    if (!watchlistCount(state)) {
      return { text: "Avval /kuzat bilan xodim tanlang." };
    }
    let latest = null;
    for (const [emp, days] of Object.entries(state.staff || {})) {
      if (!wKeys.has(emp)) continue;
      const row = days[dateKey];
      if (!row?.checkIn || !row?.checkOut) continue;
      const out = new Date(row.checkOut).getTime();
      if (!latest || out > latest.out) {
        latest = { row, out };
      }
    }
    if (!latest) return { text: "Bugun tanlangan xodimlardan to'liq ketish yo'q." };
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
    if (!watchlistCount(state)) return { text: "Avval xodim tanlang: /kuzat" };
    return { text: `📅 Bugun\n\n${summarizeDay(state, dateKey, wKeys)}` };
  }
  if (data === 'cmd:rozxat') {
    return { text: formatRozxat(state) };
  }
  if (data.startsWith('wadd|')) {
    const emp = data.slice(5);
    const known = state.knownStaff?.[dateKey]?.[emp];
    addWatch(state, emp, known?.name || emp);
    return { text: `✅ Endi kuzatiladi: ${known?.name || emp}` };
  }
  if (data.startsWith('wdel|')) {
    const emp = data.slice(5);
    const name = state.watchlist?.[emp]?.name || emp;
    if (state.watchlist) delete state.watchlist[emp];
    return { text: `⛔ Kuzatish to'xtatildi: ${name}` };
  }
  if (data.startsWith('hrs|')) {
    const parts = data.split('|');
    const emp = parts[1];
    const dk = parts[2] || dateKey;
    const row = state.staff?.[emp]?.[dk];
    if (!row?.checkIn || !row?.checkOut) {
      return { text: "Ma'lumot topilmadi." };
    }
    const ms = new Date(row.checkOut) - new Date(row.checkIn);
    return {
      text:
        `👤 ${row.name}\n` +
        `📥 ${formatClock(new Date(row.checkIn))}\n` +
        `📤 ${formatClock(new Date(row.checkOut))}\n` +
        `⏱ Ish vaqti: ${formatDuration(ms)}`
    };
  }
  return null;
}

module.exports = { HELP_TEXT, isAllowed, handleCommand, handleCallback, watchedEmpKeys };
