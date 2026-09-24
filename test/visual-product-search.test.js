'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const {
  signatureFromBuffer,
  distance,
  SIG_LEN
} = require('../src/services/visual-product-search');

async function solidJpeg(r, g, b, size = 64) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r, g, b }
    }
  })
    .jpeg()
    .toBuffer();
}

describe('visual-product-search', () => {
  it('builds a fixed-length signature', async () => {
    const buf = await solidJpeg(20, 80, 200);
    const sig = await signatureFromBuffer(buf);
    assert.equal(sig.length, SIG_LEN);
  });

  it('ranks identical colors closer than opposite colors', async () => {
    const red = await signatureFromBuffer(await solidJpeg(220, 30, 30));
    const red2 = await signatureFromBuffer(await solidJpeg(210, 40, 40));
    const blue = await signatureFromBuffer(await solidJpeg(30, 40, 220));
    assert.ok(distance(red, red2) < distance(red, blue));
  });
});
