const { employeeKey, displayName } = require('./hikvision.js');

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function ensureWatchlist(state) {
  if (!state.watchlist || typeof state.watchlist !== 'object') {
    state.watchlist = {};
  }
  return state.watchlist;
}

function ensureKnown(state, dateKey) {
  if (!state.knownStaff) state.knownStaff = {};
  if (!state.knownStaff[dateKey]) state.knownStaff[dateKey] = {};
  return state.knownStaff[dateKey];
}

function recordKnownFromEvent(state, ev, dateKey) {
  const known = ensureKnown(state, dateKey);
  const key = employeeKey(ev);
  const name = displayName(ev);
  if (!known[key]) known[key] = { name, seenAt: Date.now() };
  else if (name && name !== "Noma'lum") known[key].name = name;
}

function bootstrapFromEnv(state, envList) {
  const list = ensureWatchlist(state);
  for (const item of envList) {
    const q = norm(item);
    if (!q) continue;
    list[`env:${q}`] = { name: item.trim(), fromEnv: true };
  }
}

function watchlistCount(state) {
  return Object.keys(ensureWatchlist(state)).length;
}

function isWatched(state, ev) {
  const list = ensureWatchlist(state);
  const keys = Object.keys(list);
  if (!keys.length) return false;

  const emp = employeeKey(ev);
  const name = displayName(ev);
  const nEmp = norm(emp);
  const nName = norm(name);

  if (list[emp]) return true;

  for (const [k, row] of Object.entries(list)) {
    const nRow = norm(row.name);
    if (nRow && nName && (nRow === nName || nName.includes(nRow) || nRow.includes(nName))) {
      return true;
    }
    const q = norm(k.replace(/^env:/, ''));
    if (q && (nEmp === q || nName.includes(q) || q.includes(nName))) return true;
  }
  return false;
}

function isWatchedEmpKey(state, empKey) {
  const list = ensureWatchlist(state);
  if (!list[empKey]) return false;
  return true;
}

function listWatched(state) {
  const list = ensureWatchlist(state);
  return Object.entries(list).map(([key, row]) => ({
    key,
    name: row.name || key
  }));
}

function listKnownToday(state, dateKey) {
  const known = state.knownStaff?.[dateKey] || {};
  return Object.entries(known).map(([key, row]) => ({
    key,
    name: row.name || key
  }));
}

function findKnownMatch(state, dateKey, query) {
  const q = norm(query);
  if (!q) return null;
  const known = listKnownToday(state, dateKey);
  const exact = known.find((x) => norm(x.name) === q || norm(x.key) === q);
  if (exact) return exact;
  const partial = known.filter(
    (x) => norm(x.name).includes(q) || q.includes(norm(x.name)) || norm(x.key).includes(q)
  );
  if (partial.length === 1) return partial[0];
  return partial.length > 1 ? { ambiguous: partial } : null;
}

function addWatch(state, empKey, name) {
  const list = ensureWatchlist(state);
  list[empKey] = { name: name || empKey, addedAt: Date.now() };
  return list[empKey];
}

function removeWatch(state, query, dateKey) {
  const list = ensureWatchlist(state);
  const q = norm(query);
  if (!q) return { ok: false, message: 'Ism yoki ID yozing: /olib Ali' };

  if (list[query]) {
    const name = list[query].name;
    delete list[query];
    return { ok: true, message: `Olib tashlandi: ${name}` };
  }

  for (const [key, row] of Object.entries(list)) {
    if (norm(row.name) === q || norm(key) === q) {
      delete list[key];
      return { ok: true, message: `Olib tashlandi: ${row.name}` };
    }
  }

  const match = findKnownMatch(state, dateKey, query);
  if (match?.ambiguous) {
    const names = match.ambiguous.map((x) => x.name).join(', ');
    return { ok: false, message: `Bir nechta topildi: ${names}. Aniqroq yozing.` };
  }
  if (match?.key) {
    delete list[match.key];
    return { ok: true, message: `Olib tashlandi: ${match.name}` };
  }
  return { ok: false, message: 'Kuzatish roʻyxatida topilmadi.' };
}

function addWatchByQuery(state, dateKey, query) {
  const q = norm(query);
  if (!q) return { ok: false, message: 'Ism yozing: /qosh Ali' };

  const match = findKnownMatch(state, dateKey, query);
  if (match?.ambiguous) {
    const names = match.ambiguous.map((x) => x.name).join(', ');
    return { ok: false, message: `Bir nechta topildi: ${names}. /kuzat tugmasidan tanlang.` };
  }
  if (!match?.key) {
    return {
      ok: false,
      message:
        "Bugun Face ID da bu ism topilmadi. Avval xodim terminaldan o'tsin yoki /hodimlar bilan ko'ring."
    };
  }
  addWatch(state, match.key, match.name);
  return { ok: true, message: `✅ Kuzatiladi: ${match.name}`, empKey: match.key };
}

module.exports = {
  recordKnownFromEvent,
  bootstrapFromEnv,
  watchlistCount,
  isWatched,
  isWatchedEmpKey,
  listWatched,
  listKnownToday,
  addWatch,
  removeWatch,
  addWatchByQuery,
  findKnownMatch
};
