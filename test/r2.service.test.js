'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const r2 = require('../src/services/r2.service');

const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL'
];

function stashR2Env() {
  const stash = {};
  for (const k of R2_KEYS) {
    stash[k] = process.env[k];
  }
  return stash;
}

function restoreR2Env(stash) {
  for (const k of R2_KEYS) {
    if (stash[k] === undefined) delete process.env[k];
    else process.env[k] = stash[k];
  }
}

function seedFullR2Env() {
  process.env.R2_ACCOUNT_ID = 'testacct';
  process.env.R2_ACCESS_KEY_ID = 'testkeyid';
  process.env.R2_SECRET_ACCESS_KEY = 'testsecret';
  process.env.R2_BUCKET_NAME = 'testbucket';
  process.env.R2_PUBLIC_URL = 'https://cdn.example.com/assets';
}

test('getPublicUrl trims trailing slash on base and avoids duplicate slashes', () => {
  const stash = stashR2Env();
  try {
    seedFullR2Env();
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com/';
    assert.equal(r2.getPublicUrl('banners/a.png'), 'https://cdn.example.com/banners/a.png');
    assert.equal(r2.getPublicUrl('/shorts/v.mp4'), 'https://cdn.example.com/shorts/v.mp4');
  } finally {
    restoreR2Env(stash);
  }
});

test('buildObjectKey joins prefix and sanitized filename', () => {
  assert.equal(r2.buildObjectKey('banners', 'x y.png'), 'banners/x_y.png');
  assert.equal(r2.buildObjectKey('/uploads/', 'file.bin'), 'uploads/file.bin');
});

test('sanitizeKeyFileName normalizes unsafe segments', () => {
  assert.equal(r2.sanitizeKeyFileName('a b<c>.png'), 'a_b_c_.png');
});

test('shouldUseR2 is false when configuration incomplete', () => {
  const stash = stashR2Env();
  try {
    for (const k of R2_KEYS) delete process.env[k];
    assert.equal(r2.shouldUseR2(), false);
    seedFullR2Env();
    delete process.env.R2_PUBLIC_URL;
    assert.equal(r2.shouldUseR2(), false);
  } finally {
    restoreR2Env(stash);
  }
});

test('shouldUseR2 is true when all R2 env vars are non-empty', () => {
  const stash = stashR2Env();
  try {
    seedFullR2Env();
    assert.equal(r2.shouldUseR2(), true);
    assert.equal(r2.isR2Configured(), true);
  } finally {
    restoreR2Env(stash);
  }
});

test('uploadToR2 sends PutObject with buffer body and returns public URL', async () => {
  const stash = stashR2Env();
  try {
    seedFullR2Env();
    /** @type {unknown[]} */
    const sent = [];
    r2.setR2S3ClientForTests({
      async send(cmd) {
        sent.push(cmd);
      }
    });
    const buf = Buffer.from([1, 2, 3]);
    const result = await r2.uploadToR2(buf, 'shorts/clip.mp4', 'video/mp4');
    assert.equal(result.key, 'shorts/clip.mp4');
    assert.equal(result.url, 'https://cdn.example.com/assets/shorts/clip.mp4');
    assert.equal(sent.length, 1);
    assert.ok(sent[0] instanceof PutObjectCommand);
    const input = /** @type {{ Bucket: string, Key: string, Body: Buffer, ContentType: string }} */ (
      sent[0].input
    );
    assert.equal(input.Bucket, 'testbucket');
    assert.equal(input.Key, 'shorts/clip.mp4');
    assert.ok(Buffer.isBuffer(input.Body));
    assert.deepEqual(input.Body, buf);
    assert.equal(input.ContentType, 'video/mp4');
  } finally {
    r2.clearR2S3ClientForTests();
    restoreR2Env(stash);
  }
});

test('deleteFromR2 sends DeleteObject', async () => {
  const stash = stashR2Env();
  try {
    seedFullR2Env();
    /** @type {unknown[]} */
    const sent = [];
    r2.setR2S3ClientForTests({
      async send(cmd) {
        sent.push(cmd);
      }
    });
    await r2.deleteFromR2('banners/old.png');
    assert.equal(sent.length, 1);
    assert.ok(sent[0] instanceof DeleteObjectCommand);
    assert.equal(sent[0].input.Bucket, 'testbucket');
    assert.equal(sent[0].input.Key, 'banners/old.png');
  } finally {
    r2.clearR2S3ClientForTests();
    restoreR2Env(stash);
  }
});
