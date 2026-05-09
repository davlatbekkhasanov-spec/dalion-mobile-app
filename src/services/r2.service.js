'use strict';

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const REQUIRED_ENV_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL'
];

/** @type {import('@aws-sdk/client-s3').S3Client | null} */
let testS3Client = null;

/** @type {import('@aws-sdk/client-s3').S3Client | null} */
let cachedProdClient = null;

function setR2S3ClientForTests(client) {
  testS3Client = client;
  cachedProdClient = null;
}

function clearR2S3ClientForTests() {
  testS3Client = null;
  cachedProdClient = null;
}

function isR2Configured() {
  return REQUIRED_ENV_KEYS.every((k) => String(process.env[k] || '').trim().length > 0);
}

/**
 * Use R2 whenever all R2_* variables are set (any NODE_ENV).
 * Local disk uploads apply when any variable is missing (dev-friendly fallback).
 */
function shouldUseR2() {
  return isR2Configured();
}

function sanitizeKeyFileName(name) {
  return String(name || '')
    .trim()
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 180);
}

function buildObjectKey(prefix, fileName) {
  const p = String(prefix || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  const safe = sanitizeKeyFileName(fileName);
  return `${p}/${safe}`;
}

function getPublicUrl(key) {
  const base = String(process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  const k = String(key || '').replace(/^\/+/, '').replace(/\\/g, '/');
  return `${base}/${k}`;
}

function createS3ClientFromEnv() {
  const accountId = String(process.env.R2_ACCOUNT_ID || '').trim();
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: String(process.env.R2_ACCESS_KEY_ID || '').trim(),
      secretAccessKey: String(process.env.R2_SECRET_ACCESS_KEY || '').trim()
    },
    forcePathStyle: true
  });
}

function getS3Client() {
  if (testS3Client) return testS3Client;
  if (!isR2Configured()) return null;
  if (!cachedProdClient) cachedProdClient = createS3ClientFromEnv();
  return cachedProdClient;
}

async function uploadToR2(fileBuffer, key, contentType) {
  const client = getS3Client();
  if (!client) throw new Error('R2 is not configured');
  const bucket = String(process.env.R2_BUCKET_NAME || '').trim();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType
    })
  );
  return { key, url: getPublicUrl(key) };
}

async function deleteFromR2(key) {
  const client = getS3Client();
  if (!client) throw new Error('R2 is not configured');
  const bucket = String(process.env.R2_BUCKET_NAME || '').trim();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );
}

/**
 * @returns {{ ok: true } | { ok: false, message: string, code: string, detail?: string }}
 */
function diagnoseR2PublicUrl() {
  const raw = String(process.env.R2_PUBLIC_URL || '').trim();
  if (!raw) {
    return { ok: false, message: 'R2_PUBLIC_URL sozlanmagan yoki bo‘sh', code: 'R2_PUBLIC_URL_MISSING' };
  }
  try {
    const u = new URL(raw);
    if (!/^https?:$/i.test(u.protocol)) {
      return {
        ok: false,
        message: 'R2_PUBLIC_URL faqat http yoki https bo‘lishi kerak',
        code: 'R2_PUBLIC_URL_BAD_PROTOCOL',
        detail: String(u.protocol || '')
      };
    }
  } catch {
    return {
      ok: false,
      message: 'R2_PUBLIC_URL yaroqsiz URL',
      code: 'R2_PUBLIC_URL_INVALID',
      detail: raw.slice(0, 160)
    };
  }
  return { ok: true };
}

/**
 * @param {unknown} err
 * @returns {{ code: string, hints: string[], detail: string }}
 */
function describeR2UploadFailure(err) {
  const code = String(err?.Code || err?.code || err?.name || 'R2_UPLOAD_FAILED');
  const detail = String(err?.message || err || '');
  const hints = [];
  if (/ENOTFOUND|getaddrinfo/i.test(detail)) hints.push('DNS yoki R2_ACCOUNT_ID / endpoint tekshiring');
  if (/NetworkingError|Timeout|ETIMEDOUT/i.test(code + detail)) hints.push('Tarmoq yoki firewall');
  if (/AccessDenied|403/i.test(code + detail)) hints.push('R2 kalitlari yoki bucket ruxsati');
  if (/SignatureDoesNotMatch/i.test(code + detail)) hints.push('R2_SECRET_ACCESS_KEY');
  if (/InvalidAccessKeyId/i.test(code + detail)) hints.push('R2_ACCESS_KEY_ID');
  if (/NoSuchBucket/i.test(code + detail)) hints.push('R2_BUCKET_NAME');
  return { code: code.slice(0, 120), hints, detail: detail.slice(0, 500) };
}

module.exports = {
  REQUIRED_ENV_KEYS,
  isR2Configured,
  shouldUseR2,
  getPublicUrl,
  buildObjectKey,
  sanitizeKeyFileName,
  uploadToR2,
  deleteFromR2,
  diagnoseR2PublicUrl,
  describeR2UploadFailure,
  setR2S3ClientForTests,
  clearR2S3ClientForTests
};
