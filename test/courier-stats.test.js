'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  courierEarnFromDeliveryPrice,
  aggregateCourierOrders,
  scoreForLeaderboard
} = require('../src/courier-stats');

test('courierEarnFromDeliveryPrice uses share', () => {
  const prev = process.env.COURIER_EARN_SHARE;
  process.env.COURIER_EARN_SHARE = '0.8';
  assert.equal(courierEarnFromDeliveryPrice(10000), 8000);
  process.env.COURIER_EARN_SHARE = prev;
});

test('aggregateCourierOrders counts delivered and pending', () => {
  const now = new Date();
  const rows = [
    {
      orderNumber: '100001',
      id: '1',
      status: 'delivered',
      deliveryPrice: 15000,
      courierPhone: '+998901234567',
      feedbackRating: 5,
      updatedAt: now,
      createdAt: now,
      distanceKm: 3.2
    },
    {
      orderNumber: '100002',
      id: '2',
      status: 'out_for_delivery',
      deliveryPrice: 12000,
      courierPhone: '+998901234567',
      feedbackRating: null,
      updatedAt: now,
      createdAt: now,
      distanceKm: 2
    }
  ];
  const agg = aggregateCourierOrders(rows, '+998901234567');
  assert.equal(agg.buckets.today.deliveries, 1);
  assert.equal(agg.buckets.today.earned, 12000);
  assert.equal(agg.buckets.today.pending, 9600);
  assert.equal(agg.avgRating, 5);
  assert.equal(agg.recent.length, 1);
});

test('scoreForLeaderboard prefers more deliveries', () => {
  assert.ok(
    scoreForLeaderboard({ deliveries: 10, avgRating: 4, earned: 100000 }) >
      scoreForLeaderboard({ deliveries: 2, avgRating: 5, earned: 200000 })
  );
});
