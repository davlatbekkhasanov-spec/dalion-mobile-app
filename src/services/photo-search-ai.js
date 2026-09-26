'use strict';

/**
 * OpenAI Vision → product labels for catalog search.
 * Requires OPENAI_API_KEY (or PHOTO_SEARCH_OPENAI_KEY) on the server.
 */

function getOpenAiKey() {
  let key = String(
    process.env.PHOTO_SEARCH_OPENAI_KEY || process.env.OPENAI_API_KEY || ''
  ).trim();
  // Railway/UI paste sometimes wraps in quotes or adds newlines
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/\s+/g, '');
  return key;
}

function isPhotoAiConfigured() {
  return Boolean(getOpenAiKey());
}

/**
 * Extra UZ/RU/EN synonyms so "stakan" also hits "bakal", "кружка", etc.
 * @type {Record<string, string[]>}
 */
const SYNONYM_GROUPS = [
  ['stakan', 'bakal', 'стакан', 'кружка', 'glass', 'cup', 'tumbler', 'бокал', 'кратер', 'pijola'],
  ['ramka', 'рамка', 'frame', 'photo frame', 'picture frame', 'baget', 'багет'],
  ['stul', 'стул', 'chair', 'кресло', 'kreslo'],
  ['stol', 'стол', 'table', 'парта'],
  ['telefon', 'телефон', 'phone', 'смартфон', 'smartphone'],
  ['sumka', 'сумка', 'bag', 'рюкзак', 'ryukzak', 'backpack'],
  ['soat', 'час', 'часы', 'watch', 'clock'],
  ['lamp', 'lampa', 'лампа', 'светильник', 'свет'],
  ['poyabzal', 'обувь', 'shoes', 'кроссовки', 'tufli', 'туфли'],
  ['oyinqichoq', 'игрушка', 'toy', 'yumshoq'],
  ['idish', 'посуда', 'posuda', 'тарелка', 'likopcha', 'тарелка'],
  ['qozon', 'кастрюля', 'pot', 'skovoroda', 'сковорода'],
  ['choynak', 'чайник', 'teapot', 'kettle'],
  ['muzlatgich', 'холодильник', 'fridge', 'refrigerator'],
  ['televizor', 'телевизор', 'tv', 'television']
];

function expandLabels(labels) {
  const out = new Set();
  for (const raw of labels || []) {
    const L = String(raw || '')
      .trim()
      .toLowerCase();
    if (!L || L.length < 2) continue;
    out.add(L);
    for (const group of SYNONYM_GROUPS) {
      if (group.some((g) => L.includes(g) || g.includes(L))) {
        group.forEach((g) => out.add(g));
      }
    }
  }
  return [...out];
}

/**
 * @param {Buffer} buffer
 * @param {string} [mimeType]
 * @returns {Promise<null|{object:string,labels:string[],query:string,confidence:number,raw?:object}>}
 */
async function labelProductPhoto(buffer, mimeType = 'image/jpeg') {
  const key = getOpenAiKey();
  if (!key || !buffer || !buffer.length) return null;

  const model = String(process.env.PHOTO_SEARCH_OPENAI_MODEL || 'gpt-4o-mini').trim();
  const b64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${b64}`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Number(process.env.PHOTO_SEARCH_AI_TIMEOUT_MS || 20000));

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content:
              'You are a precise retail product identifier for GlobusMarket (Uzbekistan). ' +
              'Name ONLY the main foreground product a shopper would buy. ' +
              'Never confuse a drinking glass/cup with a picture frame, and never name background furniture. ' +
              'Reply with JSON only.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'What is the ONE main product in this photo?\n' +
                  'Rules:\n' +
                  '- If it is a glass/cup/mug for drinking → object="drinking glass", labels must include stakan, bakal, стакан, кружка\n' +
                  '- If it is a picture/photo frame → object="picture frame", labels must include ramka, рамка\n' +
                  '- Ignore table, wall, hand, background\n' +
                  'Return JSON:\n' +
                  '{\n' +
                  '  "object": "short English product type",\n' +
                  '  "labels": ["uz","ru","en synonyms — 8 to 14"],\n' +
                  '  "query": "best Uzbek or Russian catalog search phrase",\n' +
                  '  "confidence": 0.0\n' +
                  '}\n' +
                  'If unclear, confidence < 0.4 and labels=[].'
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl, detail: 'low' }
              }
            ]
          }
        ]
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let detail = errText.slice(0, 280);
      try {
        const j = JSON.parse(errText);
        detail = String(j?.error?.message || j?.message || detail).slice(0, 280);
      } catch (_) {}
      const err = new Error(`openai_http_${res.status}`);
      err.detail = detail;
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const content = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!content) {
      const err = new Error('openai_empty_content');
      err.detail = 'OpenAI bo‘sh javob qaytardi';
      throw err;
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const err = new Error('openai_bad_json');
      err.detail = content.slice(0, 180);
      throw err;
    }

    const labels = expandLabels([
      ...(Array.isArray(parsed.labels) ? parsed.labels : []),
      parsed.object,
      parsed.query
    ]);
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));

    if (!labels.length || confidence < 0.4) {
      return {
        object: String(parsed.object || '').trim(),
        labels,
        query: String(parsed.query || parsed.object || '').trim(),
        confidence,
        raw: parsed,
        emptyReason: !labels.length ? 'no_labels' : 'low_confidence'
      };
    }

    return {
      object: String(parsed.object || '').trim(),
      labels,
      query: String(parsed.query || parsed.object || '').trim(),
      confidence,
      raw: parsed
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  isPhotoAiConfigured,
  labelProductPhoto,
  expandLabels,
  SYNONYM_GROUPS
};
