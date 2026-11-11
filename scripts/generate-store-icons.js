'use strict';

/**
 * Generate branded store / launcher icons (no design tools required).
 * Output: resources/icon.png (1024) + splash.png + ios AppIcon + android mipmaps via capacitor sync later.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'resources');

async function makeIcon(size) {
  const r = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.42);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#5af5b4"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="#050b18"/>
  <rect x="${size * 0.08}" y="${size * 0.08}" width="${size * 0.84}" height="${size * 0.84}" rx="${r * 0.85}" fill="url(#g)"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial Black, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" fill="#041018">G</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function makeSplash(w, h) {
  const icon = Math.round(Math.min(w, h) * 0.28);
  const iconBuf = await makeIcon(icon);
  const base = await sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 5, g: 11, b: 24 }
    }
  })
    .png()
    .toBuffer();
  return sharp(base)
    .composite([{ input: iconBuf, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const icon1024 = await makeIcon(1024);
  fs.writeFileSync(path.join(OUT, 'icon.png'), icon1024);
  fs.writeFileSync(path.join(OUT, 'icon-foreground.png'), icon1024);
  const splash = await makeSplash(2732, 2732);
  fs.writeFileSync(path.join(OUT, 'splash.png'), splash);

  // iOS marketing icon
  const iosIconDir = path.join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
  if (fs.existsSync(iosIconDir)) {
    fs.writeFileSync(path.join(iosIconDir, 'AppIcon-512@2x.png'), icon1024);
  }

  // Android launcher densities
  const dens = [
    ['mipmap-mdpi', 48],
    ['mipmap-hdpi', 72],
    ['mipmap-xhdpi', 96],
    ['mipmap-xxhdpi', 144],
    ['mipmap-xxxhdpi', 192]
  ];
  for (const [folder, size] of dens) {
    const dir = path.join(ROOT, 'android/app/src/main/res', folder);
    if (!fs.existsSync(dir)) continue;
    const buf = await makeIcon(size);
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), buf);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), buf);
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), buf);
  }

  // Android splash drawables (reuse)
  const splashDirs = [
    'drawable',
    'drawable-port-mdpi',
    'drawable-port-hdpi',
    'drawable-port-xhdpi',
    'drawable-port-xxhdpi',
    'drawable-port-xxxhdpi',
    'drawable-land-mdpi',
    'drawable-land-hdpi',
    'drawable-land-xhdpi',
    'drawable-land-xxhdpi',
    'drawable-land-xxxhdpi'
  ];
  const splashMd = await makeSplash(1280, 1920);
  for (const folder of splashDirs) {
    const dir = path.join(ROOT, 'android/app/src/main/res', folder);
    if (!fs.existsSync(dir)) continue;
    fs.writeFileSync(path.join(dir, 'splash.png'), splashMd);
  }

  // iOS splash imageset
  const iosSplashDir = path.join(ROOT, 'ios/App/App/Assets.xcassets/Splash.imageset');
  if (fs.existsSync(iosSplashDir)) {
    fs.writeFileSync(path.join(iosSplashDir, 'splash-2732x2732.png'), splash);
    fs.writeFileSync(path.join(iosSplashDir, 'splash-2732x2732-1.png'), splash);
    fs.writeFileSync(path.join(iosSplashDir, 'splash-2732x2732-2.png'), splash);
  }

  console.log('Generated resources/icon.png, splash.png and native launcher assets');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
