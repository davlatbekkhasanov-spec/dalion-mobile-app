const { isCheckout, employeeKey, displayName, parseEventTime } = require('./hikvision.js');

function formatClock(d) {
  if (!d) return '—';
  return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0 daq';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} daq`;
  if (m === 0) return `${h} soat`;
  return `${h} soat ${m} daq`;
}

function ensureStaffDay(state, empKey, dateKey, name) {
  if (!state.staff[empKey]) state.staff[empKey] = {};
  if (!state.staff[empKey][dateKey]) {
    state.staff[empKey][dateKey] = {
      name,
      checkIn: null,
      checkOut: null,
      lastEventAt: null
    };
  }
  const row = state.staff[empKey][dateKey];
  if (name && row.name !== name) row.name = name;
  return row;
}

/**
 * @returns {{ type: 'in'|'out'|null, row, durationMs?: number, durationText?: string }}
 */
function applyEvent(state, ev, dateKey) {
  const emp = employeeKey(ev);
  const name = displayName(ev);
  const at = parseEventTime(ev);
  const row = ensureStaffDay(state, emp, dateKey, name);
  if (at) row.lastEventAt = at.toISOString();

  if (isCheckout(ev)) {
    if (!row.checkIn) {
      row.checkOut = at ? at.toISOString() : null;
      return { type: null, row };
    }
    row.checkOut = at ? at.toISOString() : null;
    const inDate = new Date(row.checkIn);
    const outDate = at || new Date();
    const durationMs = outDate - inDate;
    return {
      type: 'out',
      row,
      emp,
      durationMs,
      durationText: formatDuration(durationMs)
    };
  }

  if (at) row.checkIn = at.toISOString();
  return { type: 'in', row, emp };
}

function summarizeDay(state, dateKey, onlyEmpKeys = null) {
  const lines = [];
  for (const [emp, days] of Object.entries(state.staff || {})) {
    if (onlyEmpKeys && !onlyEmpKeys.has(emp)) continue;
    const row = days[dateKey];
    if (!row) continue;
    const inT = row.checkIn ? formatClock(new Date(row.checkIn)) : '—';
    const outT = row.checkOut ? formatClock(new Date(row.checkOut)) : '—';
    let dur = '—';
    if (row.checkIn && row.checkOut) {
      dur = formatDuration(new Date(row.checkOut) - new Date(row.checkIn));
    } else if (row.checkIn && !row.checkOut) {
      dur = 'hali ishda';
    }
    lines.push(`• ${row.name}\n  📥 ${inT}  📤 ${outT}  ⏱ ${dur}`);
  }
  if (!lines.length) return "Bugun hali yozuv yo'q.";
  return lines.join('\n\n');
}

function whoIsIn(state, dateKey, onlyEmpKeys = null) {
  const inside = [];
  for (const [emp, days] of Object.entries(state.staff || {})) {
    if (onlyEmpKeys && !onlyEmpKeys.has(emp)) continue;
    const row = days[dateKey];
    if (row?.checkIn && !row.checkOut) inside.push(row.name);
  }
  if (!inside.length) return 'Hozir hech kim ichkarida emas (yoki kelish qayd etilmagan).';
  return `Hozir ichkarida:\n${inside.map((n) => `• ${n}`).join('\n')}`;
}

module.exports = {
  applyEvent,
  summarizeDay,
  whoIsIn,
  formatClock,
  formatDuration
};
