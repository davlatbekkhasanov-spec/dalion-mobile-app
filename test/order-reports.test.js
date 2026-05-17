'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  buildOrderChannelReports,
  resolveReportRange,
  dateKeyInTz
} = require('../src/order-reports');

function order(overrides = {}) {
  return {
    status: 'preparing',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    total: 100000,
    created_at: '2026-05-17T10:00:00.000Z',
    ...overrides
  };
}

test('resolveReportRange: defaults last 30 days ending today', () => {
  const r = resolveReportRange('', '', { today: '2026-05-17', defaultDays: 30 });
  assert.strictEqual(r.to, '2026-05-17');
  assert.strictEqual(r.from, '2026-04-18');
});

test('buildOrderChannelReports: marketplace vs tablo filter', () => {
  const orders = [
    order({ total: 50000, created_at: '2026-05-17T08:00:00.000Z' }),
    order({
      status: 'payment_pending',
      total: 20000,
      created_at: '2026-05-17T09:00:00.000Z'
    }),
    order({
      paymentMethod: 'payme',
      paymentStatus: 'pending',
      total: 30000,
      created_at: '2026-05-17T11:00:00.000Z'
    }),
    order({
      paymentMethod: 'payme',
      paymentStatus: 'paid',
      total: 40000,
      created_at: '2026-05-17T12:00:00.000Z'
    })
  ];
  const report = buildOrderChannelReports(orders, {
    from: '2026-05-17',
    to: '2026-05-17',
    today: '2026-05-17'
  });
  assert.strictEqual(report.marketplace.summary.period.count, 4);
  assert.strictEqual(report.marketplace.summary.period.totalSum, 140000);
  assert.strictEqual(report.tablo.summary.period.count, 2);
  assert.strictEqual(report.tablo.summary.period.totalSum, 90000);
});

test('buildOrderChannelReports: daily breakdown by Tashkent date', () => {
  const created = '2026-05-16T12:00:00.000Z';
  const key = dateKeyInTz(created);
  const orders = [order({ total: 10000, created_at: created })];
  const report = buildOrderChannelReports(orders, { from: key, to: key, today: key });
  assert.strictEqual(report.marketplace.daily.length, 1);
  assert.strictEqual(report.marketplace.daily[0].date, key);
  assert.strictEqual(report.marketplace.daily[0].count, 1);
});
