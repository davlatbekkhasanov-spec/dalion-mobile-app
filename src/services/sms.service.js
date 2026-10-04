const DEVSMS_DEFAULT_URL = 'https://devsms.uz/api/send_sms.php';
const DEVSMS_BALANCE_URL = 'https://devsms.uz/api/get_balance.php';
const DEVSMS_HISTORY_URL = 'https://devsms.uz/api/get_history.php';
const DEVSMS_STATUS_URL = 'https://devsms.uz/api/get_status.php';

// Short body — long free-form OTP text is often accepted then dropped by operators.
const DEFAULT_SMS_OTP_MESSAGE_TEMPLATE =
  'GlobusMarket: tasdiqlash kodi {{code}}. Uni boshqalarga bermang.';

function parseDevsmsHostname(urlString) {
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch (_) {
    return '';
  }
}

const gatewayMode = () => {
  const envModeRaw = process.env.SMS_GATEWAY_MODE || process.env.SMS_PROVIDER;
  const envMode = String(envModeRaw || '').trim().toLowerCase();
  if (envMode === 'mock') return 'log';

  const key = String(process.env.DEVSMS_API_KEY || process.env.SMS_API_KEY || '').trim();
  const genericUrl = String(process.env.SMS_API_URL || '').trim();
  const devsmsUrl = String(process.env.DEVSMS_API_URL || DEVSMS_DEFAULT_URL).trim();
  const host = parseDevsmsHostname(devsmsUrl);
  const targetsDevsmsHost = host === 'devsms.uz' || host.endsWith('.devsms.uz');

  let resolved = envMode;
  if (!resolved && key && !genericUrl && targetsDevsmsHost) {
    resolved = 'devsms';
  }
  if (!resolved) resolved = 'log';

  const normalized = ['log', 'twilio', 'eskiz', 'generic', 'devsms'].includes(resolved) ? resolved : 'log';
  if (normalized === 'devsms' && !key) return 'log';
  return normalized;
};

function shouldLogOtpPlaintext() {
  return String(process.env.SMS_LOG_OTP_CODE || '').toLowerCase() === 'true';
}

function logSms(phone, code, extra = {}) {
  console.info('[SMS_GATEWAY_MODE=log]', {
    to: phone,
    ...extra,
    otp: shouldLogOtpPlaintext() ? code : '[REDACTED]'
  });
}

function sanitizeSmsClientDetail(text, maxLen = 96) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  return s
    .replace(/[A-Za-z0-9._-]{36,}/g, '[…]')
    .slice(0, maxLen)
    .trim();
}

function isDevsmsSuccess(data, httpOk) {
  if (!httpOk) return false;
  if (data?.charged === false || data?.data?.charged === false) return false;
  const status = String(data?.data?.status || data?.status || '')
    .trim()
    .toLowerCase();
  if (['failed', 'rejected', 'error', 'blocked', 'forbidden'].includes(status)) return false;
  const s = data?.success;
  if (s === true || s === 'true' || s === 1 || s === '1') return true;
  if (s === false || s === 'false' || s === 0 || s === '0') return false;
  if (data?.error != null && String(data.error).trim() !== '') return false;
  if (status === 'sent' || status === 'queued') return true;
  return false;
}

function devsmsFailureMessage(data, httpStatus, nonJson) {
  if (nonJson) return `DevSMS javobi JSON emas (HTTP ${httpStatus})`;
  const msg = data?.message ?? data?.error ?? data?.msg;
  if (typeof msg === 'string' && msg.trim()) return msg.trim().slice(0, 280);
  if (data?.charged === false || data?.data?.charged === false) {
    return 'SMS yuborilmadi (provayder to‘lov yechmadi / shablon rad etildi)';
  }
  return `DevSMS xato: HTTP ${httpStatus}`;
}

function devsmsAuthHeaders() {
  const apiKey = String(process.env.DEVSMS_API_KEY || process.env.SMS_API_KEY || '').trim();
  const authMode = String(process.env.DEVSMS_AUTH_MODE || 'bearer').trim().toLowerCase();
  const headers = { Accept: 'application/json' };
  if ((authMode === 'bearer' || authMode === 'both') && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return { apiKey, authMode, headers };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendViaTwilio(phone, code) {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const from = String(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM || '').trim();
  if (!sid || !token || !from) {
    return { ok: false, message: 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER kerak' };
  }
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const body = new URLSearchParams({
    To: phone,
    From: from,
    Body: String(process.env.SMS_TWILIO_BODY_TEMPLATE || 'GlobusMarket tasdiqlash kodi: {{code}}').replace(
      /\{\{code\}\}/g,
      code
    )
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, message: `Twilio xato: ${res.status}`, detail: text.slice(0, 200) };
  }
  return { ok: true };
}

async function sendViaGeneric(phone, code) {
  const url = String(process.env.SMS_API_URL || '').trim();
  const key = String(process.env.SMS_API_KEY || '').trim();
  const sender = String(process.env.SMS_SENDER || '').trim();
  if (!url) {
    return { ok: false, message: 'SMS_API_URL majburiy (generic rejim)' };
  }
  const message = String(process.env.SMS_MESSAGE_TEMPLATE || DEFAULT_SMS_OTP_MESSAGE_TEMPLATE).replace(
    /\{\{code\}\}/g,
    code
  );
  const payloadRaw = String(process.env.SMS_REQUEST_BODY_TEMPLATE || '').trim();
  let bodyObj;
  if (payloadRaw) {
    try {
      bodyObj = JSON.parse(
        payloadRaw
          .replace(/\{\{phone\}\}/g, phone)
          .replace(/\{\{code\}\}/g, code)
          .replace(/\{\{sender\}\}/g, sender)
          .replace(/\{\{message\}\}/g, message)
      );
    } catch (_) {
      return { ok: false, message: 'SMS_REQUEST_BODY_TEMPLATE JSON emas' };
    }
  } else {
    bodyObj = { phone, code, sender, message };
  }
  const headers = { 'Content-Type': 'application/json' };
  if (key) {
    const headerName = String(process.env.SMS_API_KEY_HEADER || 'Authorization').trim();
    const prefix = String(process.env.SMS_API_KEY_PREFIX || 'Bearer ').trim();
    headers[headerName] = prefix ? `${prefix}${key}` : key;
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(bodyObj) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, message: `SMS API xato: ${res.status}`, detail: text.slice(0, 200) };
  }
  return { ok: true };
}

async function sendViaEskiz(phone, code) {
  if (!String(process.env.SMS_API_URL || '').trim()) {
    return {
      ok: false,
      message: 'Eskiz rejimi hozircha SMS_API_URL orqali generic HTTP yuborishni ishlatadi (provayder REST ni sozlang)'
    };
  }
  return sendViaGeneric(phone, code);
}

function devsmsPhoneDigits(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('998') && d.length >= 12) return d.slice(0, 12);
  const nine = d.length >= 9 ? d.slice(-9) : '';
  if (/^[1-9]\d{8}$/.test(nine)) return `998${nine}`;
  return '';
}

async function parseDevsmsJsonResponse(res) {
  const rawText = await res.text().catch(() => '');
  let data = {};
  let nonJson = false;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (_) {
    nonJson = true;
    data = {};
  }
  return { data, nonJson, rawText, httpOk: res.ok, httpStatus: res.status };
}

function extractDevsmsMeta(data) {
  const d = data?.data && typeof data.data === 'object' ? data.data : {};
  return {
    smsId: d.sms_id != null ? d.sms_id : data?.sms_id != null ? data.sms_id : null,
    requestId: d.request_id || data?.request_id || null,
    status: d.status || data?.status || null,
    balance: d.balance != null ? d.balance : data?.balance != null ? data.balance : null,
    charged: d.charged != null ? d.charged : data?.charged != null ? data.charged : null,
    type: d.type || data?.type || null
  };
}

async function fetchDevsmsBalance() {
  const { apiKey, headers } = devsmsAuthHeaders();
  if (!apiKey) return { ok: false, message: 'DEVSMS_API_KEY yo‘q' };
  const res = await fetch(DEVSMS_BALANCE_URL, { method: 'GET', headers });
  const parsed = await parseDevsmsJsonResponse(res);
  if (!isDevsmsSuccess(parsed.data, parsed.httpOk) && parsed.data?.success !== true) {
    return {
      ok: false,
      message: devsmsFailureMessage(parsed.data, parsed.httpStatus, parsed.nonJson),
      httpStatus: parsed.httpStatus
    };
  }
  const d = parsed.data?.data || {};
  return {
    ok: true,
    balance: d.balance,
    smsPrice: d.sms_price,
    statistics: d.statistics || null
  };
}

async function fetchDevsmsHistory({ limit = 20, status = '' } = {}) {
  const { apiKey, headers } = devsmsAuthHeaders();
  if (!apiKey) return { ok: false, message: 'DEVSMS_API_KEY yo‘q' };
  const q = new URLSearchParams();
  q.set('limit', String(Math.min(50, Math.max(1, Number(limit) || 20))));
  if (status) q.set('status', String(status));
  const res = await fetch(`${DEVSMS_HISTORY_URL}?${q}`, { method: 'GET', headers });
  const parsed = await parseDevsmsJsonResponse(res);
  if (parsed.data?.success === false) {
    return {
      ok: false,
      message: devsmsFailureMessage(parsed.data, parsed.httpStatus, parsed.nonJson)
    };
  }
  const history = Array.isArray(parsed.data?.data?.history)
    ? parsed.data.data.history
    : Array.isArray(parsed.data?.history)
      ? parsed.data.history
      : [];
  return {
    ok: true,
    history: history.slice(0, 50).map((h) => ({
      id: h.id,
      phone: h.phone_number || h.phone || '',
      status: h.status || '',
      from: h.from_number || h.from || '',
      partsCount: h.parts_count,
      totalCost: h.total_cost,
      sentAt: h.sent_at || null,
      deliveredAt: h.delivered_at || null,
      failedAt: h.failed_at || null,
      createdAt: h.created_at || null,
      // never return full message body with OTP to admin JSON by default — truncate
      messagePreview: String(h.message || '')
        .replace(/\d{4,8}/g, '****')
        .slice(0, 80)
    }))
  };
}

async function fetchDevsmsStatus({ smsId, requestId } = {}) {
  const { apiKey, headers } = devsmsAuthHeaders();
  if (!apiKey) return { ok: false, message: 'DEVSMS_API_KEY yo‘q' };
  const q = new URLSearchParams();
  if (smsId != null && String(smsId).trim()) q.set('sms_id', String(smsId).trim());
  if (requestId) q.set('request_id', String(requestId).trim());
  if (![...q.keys()].length) return { ok: false, message: 'sms_id yoki request_id kerak' };
  const res = await fetch(`${DEVSMS_STATUS_URL}?${q}`, { method: 'GET', headers });
  const parsed = await parseDevsmsJsonResponse(res);
  const d = parsed.data?.data || parsed.data || {};
  return {
    ok: parsed.httpOk && parsed.data?.success !== false,
    status: String(d.status || '').toLowerCase() || null,
    raw: {
      status: d.status || null,
      delivered_at: d.delivered_at || null,
      failed_at: d.failed_at || null,
      sent_at: d.sent_at || null
    },
    httpStatus: parsed.httpStatus,
    message: parsed.data?.message || parsed.data?.error || null
  };
}

function buildDevsmsPayload(phoneDigits, code) {
  const from = String(process.env.DEVSMS_SENDER_FROM || process.env.SMS_SENDER || '4546').trim();
  const callbackUrl = String(process.env.DEVSMS_CALLBACK_URL || '').trim();
  const message = String(
    process.env.DEVSMS_OTP_MESSAGE_TEMPLATE || process.env.SMS_MESSAGE_TEMPLATE || DEFAULT_SMS_OTP_MESSAGE_TEMPLATE
  ).replace(/\{\{code\}\}/g, code);

  // Prefer universal_otp (approved Eskiz templates). Force free-form with DEVSMS_SMS_TYPE=eskiz|simple|message.
  const smsTypeRaw = String(process.env.DEVSMS_SMS_TYPE || 'universal_otp').trim().toLowerCase();
  const forceMessage = ['eskiz', 'simple', 'message', 'custom', 'text'].includes(smsTypeRaw);
  const useUniversal =
    !forceMessage &&
    (smsTypeRaw === 'universal_otp' || smsTypeRaw === 'otp' || smsTypeRaw === 'universal' || !smsTypeRaw);

  let payload;
  let modeLabel;
  if (useUniversal) {
    const templateType = Math.min(
      4,
      Math.max(1, Number(process.env.DEVSMS_OTP_TEMPLATE_TYPE || 3) || 3)
    );
    const serviceName = String(process.env.DEVSMS_SERVICE_NAME || 'GlobusMarket')
      .trim()
      .replace(/[^\p{L}\p{N}\s.\-]/gu, '')
      .slice(0, 50);
    payload = {
      phone: phoneDigits,
      type: 'universal_otp',
      template_type: templateType,
      service_name: serviceName || 'GlobusMarket',
      otp_code: String(code || '').trim()
    };
    modeLabel = 'universal_otp';
  } else {
    payload = {
      phone: phoneDigits,
      message,
      from: from || '4546'
    };
    if (smsTypeRaw && !['message', 'custom', 'text'].includes(smsTypeRaw)) {
      payload.type = smsTypeRaw;
    }
    modeLabel = payload.type || 'message';
  }

  if (callbackUrl) payload.callback_url = callbackUrl;
  return { payload, modeLabel };
}

async function postDevsmsSend(payload) {
  const url = String(process.env.DEVSMS_API_URL || DEVSMS_DEFAULT_URL).trim();
  const { apiKey, authMode, headers } = devsmsAuthHeaders();
  headers['Content-Type'] = 'application/json';
  const body = { ...payload };
  if (authMode === 'body' || authMode === 'both') {
    body.api_key = apiKey;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  return parseDevsmsJsonResponse(res);
}

async function sendViaDevsms(phone, code) {
  const apiKey = String(process.env.DEVSMS_API_KEY || process.env.SMS_API_KEY || '').trim();
  if (!apiKey) {
    return { ok: false, message: 'DEVSMS_API_KEY yoki SMS_API_KEY kerak', provider: 'devsms' };
  }
  const phoneDigits = devsmsPhoneDigits(phone);
  if (!phoneDigits) {
    return { ok: false, message: 'Telefon raqami noto‘g‘ri (DevSMS)', provider: 'devsms' };
  }

  const { payload, modeLabel } = buildDevsmsPayload(phoneDigits, code);
  let parsed = await postDevsmsSend(payload);
  let usedMode = modeLabel;

  // If universal_otp is rejected, fall back once to short free-form message.
  if (!isDevsmsSuccess(parsed.data, parsed.httpOk) && payload.type === 'universal_otp') {
    const from = String(process.env.DEVSMS_SENDER_FROM || process.env.SMS_SENDER || '4546').trim();
    const message = String(
      process.env.DEVSMS_OTP_MESSAGE_TEMPLATE || process.env.SMS_MESSAGE_TEMPLATE || DEFAULT_SMS_OTP_MESSAGE_TEMPLATE
    ).replace(/\{\{code\}\}/g, code);
    const fallback = {
      phone: phoneDigits,
      message,
      from: from || '4546'
    };
    const callbackUrl = String(process.env.DEVSMS_CALLBACK_URL || '').trim();
    if (callbackUrl) fallback.callback_url = callbackUrl;
    parsed = await postDevsmsSend(fallback);
    usedMode = 'message_fallback';
  }

  const meta = extractDevsmsMeta(parsed.data);
  const success = isDevsmsSuccess(parsed.data, parsed.httpOk);

  if (!success) {
    const msg = devsmsFailureMessage(parsed.data, parsed.httpStatus, parsed.nonJson);
    return {
      ok: false,
      message: typeof msg === 'string' ? msg.slice(0, 220) : 'SMS yuborilmadi',
      provider: 'devsms',
      clientDetail: sanitizeSmsClientDetail(msg),
      logContext: {
        httpStatus: parsed.httpStatus,
        responseKeys: Object.keys(parsed.data || {}),
        nonJson: parsed.nonJson,
        sendMode: usedMode,
        rawSnippet: parsed.nonJson ? sanitizeSmsClientDetail(parsed.rawText, 160) : undefined,
        ...meta
      }
    };
  }

  // Re-check status shortly after accept — catch fast failures instead of fake "Kod yuborildi".
  const verifyRaw = process.env.DEVSMS_STATUS_VERIFY_MS;
  const verifyMs =
    verifyRaw === undefined || verifyRaw === ''
      ? 2800
      : Math.min(8000, Math.max(0, Number(verifyRaw)));
  if (Number.isFinite(verifyMs) && verifyMs > 0 && (meta.smsId != null || meta.requestId)) {
    await sleep(verifyMs);
    try {
      const st = await fetchDevsmsStatus({ smsId: meta.smsId, requestId: meta.requestId });
      if (st.status && ['failed', 'rejected', 'error', 'blocked', 'forbidden'].includes(st.status)) {
        return {
          ok: false,
          message: `SMS yetkazilmadi (status: ${st.status})`,
          provider: 'devsms',
          clientDetail: sanitizeSmsClientDetail(st.message || st.status),
          logContext: { sendMode: usedMode, verifyStatus: st.status, ...meta }
        };
      }
      if (st.status) meta.status = st.status;
    } catch (_) {
      // ignore verify errors — keep accepted send
    }
  }

  console.info('[SMS_GATEWAY_MODE=devsms] accepted', {
    phone: phoneDigits,
    sendMode: usedMode,
    smsId: meta.smsId,
    status: meta.status,
    balance: meta.balance
  });

  return { ok: true, provider: 'devsms', meta: { ...meta, sendMode: usedMode } };
}

async function sendSmsOtp(phone, code) {
  const normalizedPhone = String(phone || '').trim();
  const normalizedCode = String(code || '').trim();
  if (!normalizedPhone || !normalizedCode) {
    return { ok: false, message: 'phone va code kerak' };
  }
  const mode = gatewayMode();
  try {
    if (mode === 'log') {
      logSms(normalizedPhone, normalizedCode);
      return { ok: true, provider: 'log' };
    }
    if (mode === 'twilio') return { ...(await sendViaTwilio(normalizedPhone, normalizedCode)), provider: mode };
    if (mode === 'eskiz') return { ...(await sendViaEskiz(normalizedPhone, normalizedCode)), provider: mode };
    if (mode === 'generic') return { ...(await sendViaGeneric(normalizedPhone, normalizedCode)), provider: mode };
    if (mode === 'devsms') return { ...(await sendViaDevsms(normalizedPhone, normalizedCode)), provider: mode };
    logSms(normalizedPhone, normalizedCode);
    return { ok: true, provider: 'log' };
  } catch (error) {
    return {
      ok: false,
      message: error?.message || String(error),
      provider: mode,
      clientDetail: sanitizeSmsClientDetail(error?.message || String(error)),
      logContext: { thrown: true }
    };
  }
}

module.exports = {
  gatewayMode,
  sendSmsOtp,
  fetchDevsmsBalance,
  fetchDevsmsHistory,
  fetchDevsmsStatus,
  buildDevsmsPayload,
  devsmsPhoneDigits
};
