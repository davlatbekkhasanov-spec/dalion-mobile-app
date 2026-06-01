/**
 * @ai_davlat_agent_pro_bot — Face ID davomat (alohida loyiha)
 * cd face-id-bot && npm run reset-bot && npm start
 */

const fs = require('fs');
const { cfg } = require('./lib/config.js');
const {
  fetchTodayEvents,
  eventDedupeKey,
  displayName,
  parseEventTime,
  labelMinor,
  todayRange
} = require('./lib/hikvision.js');
const { applyEvent, formatClock } = require('./lib/attendance.js');
const { sendMessage, answerCallback, getUpdates, checkoutKeyboard } = require('./lib/telegram.js');
const { isAllowed, handleCommand, handleCallback } = require('./lib/commands.js');
const {
  recordKnownFromEvent,
  bootstrapFromEnv,
  isWatched,
  watchlistCount
} = require('./lib/watchlist.js');

function loadState(path) {
  try {
    const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
    return {
      seen: raw.seen || {},
      staff: raw.staff || {},
      watchlist: raw.watchlist || {},
      knownStaff: raw.knownStaff || {},
      tgOffset: raw.tgOffset || 0
    };
  } catch (_) {
    return { seen: {}, staff: {}, watchlist: {}, knownStaff: {}, tgOffset: 0 };
  }
}

function saveState(path, state) {
  const keys = Object.keys(state.seen);
  if (keys.length > 5000) {
    const keep = keys.sort().slice(-3000);
    const next = {};
    for (const k of keep) next[k] = state.seen[k];
    state.seen = next;
  }
  fs.writeFileSync(
    path,
    JSON.stringify(
      {
        seen: state.seen,
        staff: state.staff,
        watchlist: state.watchlist,
        knownStaff: state.knownStaff,
        tgOffset: state.tgOffset
      },
      null,
      0
    )
  );
}

function formatCheckInMessage(ev) {
  const name = displayName(ev);
  const at = parseEventTime(ev);
  return `📥 Keldi\n👤 ${name}\n🕐 ${formatClock(at)}\n📋 ${labelMinor(ev.minor)}`;
}

function formatCheckOutMessage(row, durationText) {
  return (
    `📤 Ketdi\n👤 ${row.name}\n` +
    `📥 ${formatClock(new Date(row.checkIn))} → 📤 ${formatClock(new Date(row.checkOut))}\n` +
    `⏱ ${durationText}`
  );
}

async function processDeviceEvents(config, state, dateKey) {
  const { events } = await fetchTodayEvents(config);
  let sent = 0;
  let skipped = 0;

  for (const ev of events) {
    recordKnownFromEvent(state, ev, dateKey);
    const key = eventDedupeKey(ev);
    if (state.seen[key]) continue;
    state.seen[key] = Date.now();

    if (!isWatched(state, ev)) {
      skipped += 1;
      continue;
    }

    const result = applyEvent(state, ev, dateKey);
    if (!result.type) continue;

    if (result.type === 'in') {
      await sendMessage(config.token, config.chatId, formatCheckInMessage(ev));
      sent += 1;
    } else if (result.type === 'out' && result.durationText) {
      await sendMessage(
        config.token,
        config.chatId,
        formatCheckOutMessage(result.row, result.durationText),
        { reply_markup: checkoutKeyboard(result.emp, dateKey, result.durationText) }
      );
      sent += 1;
    }
  }
  return { total: events.length, sent, skipped };
}

async function processTelegramUpdates(config, state, dateKey) {
  let updates;
  try {
    updates = await getUpdates(config.token, state.tgOffset ? state.tgOffset + 1 : undefined);
  } catch (e) {
    console.error('[tg]', e.message || e);
    return;
  }
  if (!Array.isArray(updates) || !updates.length) return;

  for (const u of updates) {
    state.tgOffset = Math.max(state.tgOffset, u.update_id);

    if (u.callback_query) {
      const checkId = u.callback_query.message?.chat?.id || u.callback_query.from?.id;
      if (!isAllowed(checkId, config.allowedChatIds)) continue;
      const out = handleCallback(u.callback_query.data, state, dateKey);
      if (out?.text) await answerCallback(config.token, u.callback_query.id, out.text);
      continue;
    }

    const msg = u.message;
    if (!msg?.text || !msg.chat) continue;
    if (!isAllowed(msg.chat.id, config.allowedChatIds)) continue;

    const out = handleCommand(msg.text, state, dateKey);
    if (out) {
      await sendMessage(config.token, msg.chat.id, out.text, {
        reply_markup: out.reply_markup
      });
    }
  }
}

async function main() {
  const config = cfg();
  const state = loadState(config.stateFile);
  bootstrapFromEnv(state, config.trackEmployees);
  const { dateKey } = todayRange(config.tz);

  console.log(
    `[ai_davlat] Face http://${config.ip} | kuzatilgan: ${watchlistCount(state)} | poll ${config.pollSec}s`
  );

  const tick = async () => {
    try {
      const { sent, skipped } = await processDeviceEvents(config, state, dateKey);
      if (sent) console.log(`[face] xabar: ${sent}, o'tkazildi: ${skipped}`);
    } catch (e) {
      console.error('[face]', e.message || e);
    }
    try {
      await processTelegramUpdates(config, state, dateKey);
    } catch (e) {
      console.error('[tg]', e.message || e);
    }
    saveState(config.stateFile, state);
    setTimeout(tick, config.pollSec * 1000);
  };

  await tick();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
