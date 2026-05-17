'use strict';

const { normalizeOrderStatus } = require('./order-status');
const { shouldShowOnOpsBoards } = require('./order-board-filter');

const REPORT_TZ = 'Asia/Tashkent';
const TERMINAL_STATUSES = new Set(['delivered', 'cancelled']);

function dateKeyInTz(isoOrDate, timeZone = REPORT_TZ) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function addDaysToDateKey(dateKey, deltaDays) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return utc.toISOString().slice(0, 10);
}

function todayKeyInTz(timeZone = REPORT_TZ) {
  return dateKeyInTz(new Date(), timeZone);
}

function parseYmd(value) {
  const s = String(value || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return s;
}

function resolveReportRange(fromInput, toInput, opts = {}) {
  const tz = opts.timeZone || REPORT_TZ;
  const today = parseYmd(opts.today) || todayKeyInTz(tz);
  const defaultDays = Math.max(1, Number(opts.defaultDays) || 30);
  let to = parseYmd(toInput) || today;
  let from = parseYmd(fromInput);
  if (!from) from = addDaysToDateKey(to, -(defaultDays - 1));
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  return { from, to, timezone: tz, today };
}

function orderCreatedKey(order) {
  return dateKeyInTz(order?.created_at || order?.createdAt || '');
}

function orderTotal(order) {
  const n = Number(order?.total);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function bumpBucket(map, key, order) {
  if (!map[key]) map[key] = { count: 0, totalSum: 0 };
  map[key].count += 1;
  map[key].totalSum += orderTotal(order);
}

function aggregateOrdersInRange(orders, { from, to, today, includeOrder }) {
  const byStatus = {};
  const byPaymentMethod = {};
  const dailyMap = {};
  let periodCount = 0;
  let periodSum = 0;
  let todayCount = 0;
  let todaySum = 0;
  let activeCount = 0;
  let deliveredCount = 0;
  let cancelledCount = 0;

  for (const order of orders) {
    if (includeOrder && !includeOrder(order)) continue;
    const dk = orderCreatedKey(order);
    if (!dk || dk < from || dk > to) continue;

    const total = orderTotal(order);
    const status = normalizeOrderStatus(order.status);
    const method = String(order.paymentMethod || 'unknown').trim().toLowerCase() || 'unknown';

    periodCount += 1;
    periodSum += total;
    bumpBucket(dailyMap, dk, order);
    bumpBucket(byStatus, status, order);
    bumpBucket(byPaymentMethod, method, order);

    if (dk === today) {
      todayCount += 1;
      todaySum += total;
    }
    if (status === 'delivered') deliveredCount += 1;
    if (status === 'cancelled') cancelledCount += 1;
    if (!TERMINAL_STATUSES.has(status)) activeCount += 1;
  }

  const daily = Object.keys(dailyMap)
    .sort()
    .map((date) => ({ date, count: dailyMap[date].count, totalSum: dailyMap[date].totalSum }));

  const mapToList = (obj) =>
    Object.keys(obj)
      .sort()
      .map((key) => ({ key, count: obj[key].count, totalSum: obj[key].totalSum }));

  return {
    summary: {
      today: { count: todayCount, totalSum: todaySum },
      period: { count: periodCount, totalSum: periodSum },
      activeCount,
      deliveredCount,
      cancelledCount,
      byStatus: mapToList(byStatus),
      byPaymentMethod: mapToList(byPaymentMethod)
    },
    daily
  };
}

function buildOrderChannelReports(orders, rangeInput = {}) {
  const range = resolveReportRange(rangeInput.from, rangeInput.to, rangeInput);
  const base = {
    timezone: range.timezone,
    from: range.from,
    to: range.to,
    generatedAt: new Date().toISOString()
  };
  const ctx = { from: range.from, to: range.to, today: range.today };
  return {
    ...base,
    marketplace: aggregateOrdersInRange(orders, ctx),
    tablo: aggregateOrdersInRange(orders, {
      ...ctx,
      includeOrder: shouldShowOnOpsBoards
    })
  };
}

module.exports = {
  REPORT_TZ,
  dateKeyInTz,
  resolveReportRange,
  buildOrderChannelReports,
  aggregateOrdersInRange,
  shouldShowOnOpsBoards
};
