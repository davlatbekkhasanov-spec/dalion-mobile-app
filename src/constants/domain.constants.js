const ORDER_STATUSES = Object.freeze({
  NEW: 'new',
  SENT_TO_TSD: 'sent_to_tsd',
  PICKING: 'picking',
  PICKED: 'picked',
  WAITING_COURIER: 'waiting_courier',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
});

const ORDER_STATUS_LIST = Object.freeze(Object.values(ORDER_STATUSES));

const ORDER_STATUS_LABELS = Object.freeze({
  [ORDER_STATUSES.NEW]: 'Yangi buyurtma',
  [ORDER_STATUSES.SENT_TO_TSD]: 'Tovar terilmoqda',
  [ORDER_STATUSES.PICKING]: 'Tovar terilmoqda',
  [ORDER_STATUSES.PICKED]: 'Yig‘ildi / kurier kutilmoqda',
  [ORDER_STATUSES.WAITING_COURIER]: 'Yig‘ildi / kurier kutilmoqda',
  [ORDER_STATUSES.OUT_FOR_DELIVERY]: 'Kurierda',
  [ORDER_STATUSES.DELIVERED]: 'Yetkazildi',
  [ORDER_STATUSES.CANCELLED]: 'Bekor qilingan'
});

const PAYMENT_METHODS = Object.freeze({
  CASH: 'cash',
  CLICK: 'click',
  PAYME: 'payme'
});

const PAYMENT_METHOD_LIST = Object.freeze(Object.values(PAYMENT_METHODS));

const PAYMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  CASH_PENDING: 'cash_pending',
  PROOF_UPLOADED: 'proof_uploaded'
});

const API_CONFIG = Object.freeze({
  PUBLIC_BASE_PATH: '/api/v1',
  LOCATION_HEARTBEAT_SECONDS: 5,
  LOCATION_STALE_SECONDS: 20,
  LOCATION_LOST_SECONDS: 60
});

const STORE_LOCATION = Object.freeze({
  lat: 39.654572,
  lng: 66.958871,
  name: 'GlobusMarket',
  mapsUrl: 'https://maps.google.com/maps?q=39.654572,66.958871&ll=39.654572,66.958871&z=16'
});

module.exports = {
  ORDER_STATUSES,
  ORDER_STATUS_LIST,
  ORDER_STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LIST,
  PAYMENT_STATUSES,
  API_CONFIG,
  STORE_LOCATION
};
