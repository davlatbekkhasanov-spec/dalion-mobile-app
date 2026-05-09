const DEVSMS_DEFAULT_URL = 'https://devsms.uz/api/send_sms.php';

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
  const s = data?.success;
  if (s === true || s === 'true' || s === 1 || s === '1') return true;
  if (s === false || s === 'false' || s === 0 || s === '0') return false;
  if (data?.error != null && String(data.error).trim() !== '') return false;
  if (data?.data?.status === 'sent') return true;
  return false;
}

function devsmsFailureMessage(data, httpStatus, nonJson) {
  if (nonJson) return `DevSMS javobi JSON emas (HTTP ${httpStatus})`;
  const msg = data?.message ?? data?.error ?? data?.msg;
  if (typeof msg === 'string' && msg.trim()) return msg.trim().slice(0, 280);
  return `DevSMS xato: HTTP ${httpStatus}`;
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
    Body: String(process.env.SMS_TWILIO_BODY_TEMPLATE || 'GlobusMarket tasdiqlash kodi: {{code}}').replace(/\{\{code\}\}/g, code)
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
  const message = String(process.env.SMS_MESSAGE_TEMPLATE || 'Tasdiqlash kodi: {{code}}').replace(/\{\{code\}\}/g, code);
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

async function sendViaDevsms(phone, code) {
  const apiKey = String(process.env.DEVSMS_API_KEY || process.env.SMS_API_KEY || '').trim();
  const url = String(process.env.DEVSMS_API_URL || DEVSMS_DEFAULT_URL).trim();
  const from = String(process.env.DEVSMS_SENDER_FROM || process.env.SMS_SENDER || '4546').trim();
  const callbackUrl = String(process.env.DEVSMS_CALLBACK_URL || '').trim();
  const authMode = String(process.env.DEVSMS_AUTH_MODE || 'bearer').trim().toLowerCase();
  if (!apiKey) {
    return { ok: false, message: 'DEVSMS_API_KEY yoki SMS_API_KEY kerak', provider: 'devsms' };
  }
  const phoneDigits = devsmsPhoneDigits(phone);
  if (!phoneDigits) {
    return { ok: false, message: 'Telefon raqami noto‘g‘ri (DevSMS)', provider: 'devsms' };
  }
  const message = String(
    process.env.DEVSMS_OTP_MESSAGE_TEMPLATE ||
      process.env.SMS_MESSAGE_TEMPLATE ||
      'GlobusMarket: tasdiqlash kodi {{code}}. Uni boshqalarga bermang.'
  ).replace(/\{\{code\}\}/g, code);
  const smsType = String(process.env.DEVSMS_SMS_TYPE || '').trim();

  let payload;
  if (smsType === 'universal_otp') {
    const templateType = Math.min(4, Math.max(1, Number(process.env.DEVSMS_OTP_TEMPLATE_TYPE || 4) || 4));
    const serviceName = String(process.env.DEVSMS_SERVICE_NAME || 'GlobusMarket').trim().slice(0, 50);
    payload = {
      phone: phoneDigits,
      type: 'universal_otp',
      template_type: templateType,
      service_name: serviceName || 'GlobusMarket',
      otp_code: String(code || '').trim()
    };
  } else {
    payload = {
      phone: phoneDigits,
      message,
      from: from || '4546'
    };
    if (smsType) payload.type = smsType;
  }

  if (callbackUrl) payload.callback_url = callbackUrl;

  if (authMode === 'body' || authMode === 'both') {
    payload.api_key = apiKey;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (authMode === 'bearer' || authMode === 'both') {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const rawText = await res.text().catch(() => '');
  let data = {};
  let nonJson = false;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (_) {
    nonJson = true;
    data = {};
  }

  const httpOk = res.ok;
  const success = isDevsmsSuccess(data, httpOk);

  if (!success) {
    const msg = devsmsFailureMessage(data, res.status, nonJson);
    return {
      ok: false,
      message: typeof msg === 'string' ? msg.slice(0, 220) : 'SMS yuborilmadi',
      provider: 'devsms',
      clientDetail: sanitizeSmsClientDetail(msg),
      logContext: {
        httpStatus: res.status,
        responseKeys: Object.keys(data || {}),
        nonJson,
        rawSnippet: nonJson ? sanitizeSmsClientDetail(rawText, 160) : undefined
      }
    };
  }
  return { ok: true, provider: 'devsms' };
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
  sendSmsOtp
};
