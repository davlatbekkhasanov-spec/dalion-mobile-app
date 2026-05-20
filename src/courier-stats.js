'use strict';

const { phonesEqual } = require('./phone');

const DELIVERED = 'delivered';
const ACTIVE = new Set(['courier_assigned', 'out_for_delivery']);

function courierEarnShare() {
  const n = Number(process.env.COURIER_EARN_SHARE || 0.8);
  if (!Number.isFinite(n)) return 0.8;
  return Math.min(1, Math.max(0.35, n));
}

function courierEarnFromDeliveryPrice(deliveryPrice) {
  const price = Math.max(0, Math.round(Number(deliveryPrice) || 0));
  return Math.round(price * courierEarnShare());
}

function startOfDayTz(date, offsetMin = 300) {
  const d = date instanceof Date ? date : new Date(date);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const local = new Date(utc + offsetMin * 60000);
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() - offsetMin * 60000);
}

function startOfWeekTz(date, offsetMin = 300) {
  const sod = startOfDayTz(date, offsetMin);
  const utc = sod.getTime() + sod.getTimezoneOffset() * 60000;
  const local = new Date(utc + offsetMin * 60000);
  const day = local.getDay();
  const diff = day === 0 ? 6 : day - 1;
  local.setDate(local.getDate() - diff);
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() - offsetMin * 60000);
}

function startOfMonthTz(date, offsetMin = 300) {
  const d = date instanceof Date ? date : new Date(date);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const local = new Date(utc + offsetMin * 60000);
  local.setDate(1);
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() - offsetMin * 60000);
}

function aggregateCourierOrders(rows, phone) {
  const mine = rows.filter((o) => phonesEqual(o.courierPhone, phone));
  const now = new Date();
  const day0 = startOfDayTz(now);
  const week0 = startOfWeekTz(now);
  const month0 = startOfMonthTz(now);

  const buckets = {
    today: { deliveries: 0, earned: 0, pending: 0, distanceKm: 0 },
    week: { deliveries: 0, earned: 0, pending: 0, distanceKm: 0 },
    month: { deliveries: 0, earned: 0, pending: 0, distanceKm: 0 },
    all: { deliveries: 0, earned: 0, pending: 0, distanceKm: 0 }
  };

  const ratings = [];
  const recent = [];

  for (const o of mine) {
    const st = String(o.status || '').toLowerCase();
    const at = o.updatedAt instanceof Date ? o.updatedAt : new Date(o.updatedAt || o.createdAt);
    const fee = courierEarnFromDeliveryPrice(o.deliveryPrice);
    const dist = Number(o.distanceKm);
    const distOk = Number.isFinite(dist) && dist > 0 ? dist : 0;

    const isDelivered = st === DELIVERED;
    const isActive = ACTIVE.has(st);

    if (isDelivered) {
      const r = Number(o.feedbackRating);
      if (r >= 1 && r <= 5) ratings.push(r);
      recent.push({
        orderNumber: o.orderNumber,
        id: o.id,
        deliveredAt: at.toISOString(),
        deliveryPrice: Number(o.deliveryPrice) || 0,
        courierEarned: fee,
        rating: r >= 1 && r <= 5 ? r : null,
        distanceKm: distOk
      });
    }

    const add = (key, delivered, pending, km) => {
      if (delivered) buckets[key].deliveries += 1;
      buckets[key].earned += delivered ? fee : 0;
      buckets[key].pending += pending ? fee : 0;
      buckets[key].distanceKm += km;
    };

    if (isDelivered) {
      add('all', true, false, distOk);
      if (at >= month0) add('month', true, false, distOk);
      if (at >= week0) add('week', true, false, distOk);
      if (at >= day0) add('today', true, false, distOk);
    } else if (isActive) {
      add('all', false, true, 0);
      if (at >= month0) add('month', false, true, 0);
      if (at >= week0) add('week', false, true, 0);
      if (at >= day0) add('today', false, true, 0);
    }
  }

  recent.sort((a, b) => String(b.deliveredAt).localeCompare(String(a.deliveredAt)));

  let avgRating = 0;
  let ratingCount = ratings.length;
  if (ratingCount) {
    avgRating = Math.round((ratings.reduce((s, x) => s + x, 0) / ratingCount) * 10) / 10;
  }

  return {
    buckets,
    avgRating,
    ratingCount,
    recent: recent.slice(0, 50),
    activeCount: mine.filter((o) => ACTIVE.has(String(o.status || '').toLowerCase())).length
  };
}

function scoreForLeaderboard(entry) {
  const deliveries = entry.deliveries || 0;
  const rating = entry.avgRating || 0;
  const earned = entry.earned || 0;
  return deliveries * 10000 + rating * 100 + earned / 1000;
}

function maskPhone(phone) {
  const p = String(phone || '').trim();
  if (p.length < 8) return '—';
  return `${p.slice(0, 4)} *** ${p.slice(-2)}`;
}

module.exports = {
  courierEarnShare,
  courierEarnFromDeliveryPrice,
  aggregateCourierOrders,
  scoreForLeaderboard,
  maskPhone,
  startOfDayTz
};
