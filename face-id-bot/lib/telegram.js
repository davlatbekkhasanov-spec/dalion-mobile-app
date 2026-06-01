const TG = (token) => `https://api.telegram.org/bot${token}`;

async function tgApi(token, method, body) {
  const res = await fetch(`${TG(token)}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(`Telegram ${method}: ${data.description || res.status}`);
  }
  return data.result;
}

function sendMessage(token, chatId, text, extra = {}) {
  return tgApi(token, 'sendMessage', {
    chat_id: chatId,
    text: text.slice(0, 3900),
    disable_web_page_preview: true,
    ...extra
  });
}

function answerCallback(token, callbackQueryId, text) {
  return tgApi(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text.slice(0, 200),
    show_alert: text.length > 60
  });
}

function getUpdates(token, offset, timeout = 25) {
  return tgApi(token, 'getUpdates', {
    offset,
    timeout,
    allowed_updates: ['message', 'callback_query']
  });
}

function checkoutKeyboard(emp, dateKey, durationText) {
  const cb = `hrs|${emp}|${dateKey}`.slice(0, 64);
  return {
    inline_keyboard: [
      [{ text: `⏱ ${durationText} ishladi`, callback_data: cb }],
      [{ text: '📊 Bugungi hisobot', callback_data: 'cmd:bugun' }]
    ]
  };
}

function pickEmployeeKeyboard(knownList, watchedKeys) {
  const rows = [];
  const watched = watchedKeys || new Set();
  for (const item of knownList.slice(0, 20)) {
    const on = watched.has(item.key);
    const label = `${on ? '✅' : '➕'} ${item.name}`.slice(0, 60);
    const cb = (on ? `wdel|${item.key}` : `wadd|${item.key}`).slice(0, 64);
    rows.push([{ text: label, callback_data: cb }]);
  }
  if (!rows.length) {
    rows.push([{ text: "Bugun hodisa yo'q", callback_data: 'noop' }]);
  }
  rows.push([{ text: '📋 Kuzatiladiganlar', callback_data: 'cmd:rozxat' }]);
  return { inline_keyboard: rows };
}

module.exports = {
  sendMessage,
  answerCallback,
  getUpdates,
  checkoutKeyboard,
  pickEmployeeKeyboard
};
