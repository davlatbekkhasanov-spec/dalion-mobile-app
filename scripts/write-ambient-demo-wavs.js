#!/usr/bin/env node
/**
 * Writes uploads/audio/ambient-jazz/calm-jazz-0*.wav (tiny tones).
 * Invoked by maintainers or CI before commit; prisma seed also writes these when missing.
 */
const fs = require('fs');
const path = require('path');

const AMBIENT_DIR = path.join(__dirname, '..', 'uploads', 'audio', 'ambient-jazz');

function buildToneWav(durationSec = 0.35, freqHz = 440, volume = 0.22, sampleRate = 44100) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  const omega = (2 * Math.PI * freqHz) / sampleRate;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.sin(omega * i) * volume * 0x7fff;
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s))), 44 + i * 2);
  }
  return buf;
}

fs.mkdirSync(AMBIENT_DIR, { recursive: true });
const tones = [
  [392, 'calm-jazz-01.wav'],
  [440, 'calm-jazz-02.wav'],
  [523, 'calm-jazz-03.wav'],
  [659, 'calm-jazz-04.wav']
];
for (const [hz, name] of tones) {
  fs.writeFileSync(path.join(AMBIENT_DIR, name), buildToneWav(0.35, hz));
}
console.log('[write-ambient-demo-wavs] wrote', tones.length, 'files under', AMBIENT_DIR);
