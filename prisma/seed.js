const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ROOT = path.join(__dirname, '..');
const AMBIENT_DIR = path.join(ROOT, 'uploads', 'audio', 'ambient-jazz');
const ADMIN_AMBIENT_DIR = path.join(ROOT, 'uploads', 'audio', 'admin-ambient');
const SHORTS_UPLOAD_DIR = path.join(ROOT, 'uploads', 'shorts');

/** Canonical admin ambient playlist (slots 1–4); disk filenames match repo-tracked uploads. */
const ADMIN_AMBIENT_SLOTS = [
  {
    slot: 1,
    fileName: 'Silviana — ho capito che ti amo',
    diskFile: 'slot-1-silviana-ho-capito-che-ti-amo.mp3'
  },
  {
    slot: 2,
    fileName: 'Italianskaya Felichita',
    diskFile: 'slot-2-italy-felicita-muzce-com.mp3'
  },
  {
    slot: 3,
    fileName: 'Fausto Leali',
    diskFile: 'slot-3-fausto-leali-quando-ami-una-donna-when-a-man-loves-a-woman.mp3'
  },
  {
    slot: 4,
    fileName: 'Riccardo Cocciante',
    diskFile: 'slot-4-riccardo-cocciante-per-lei.mp3'
  }
];

/** Minimal audible PCM WAV (mono 16-bit) for demo / CI playback */
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

/** Prefer repo MP3s when present ( richer demos ); always ensure WAV exists for client fallback + thin clones. */
function ambientFileForSlot(slot) {
  const n = String(slot).padStart(2, '0');
  const base = `calm-jazz-${n}`;
  const mp3Path = path.join(AMBIENT_DIR, `${base}.mp3`);
  const wavPath = path.join(AMBIENT_DIR, `${base}.wav`);
  const hzBySlot = [392, 440, 523, 659];
  const hz = hzBySlot[slot - 1] || 440;
  fs.mkdirSync(AMBIENT_DIR, { recursive: true });
  if (!fs.existsSync(wavPath)) {
    fs.writeFileSync(wavPath, buildToneWav(0.35, hz));
  }
  if (fs.existsSync(mp3Path) && fs.statSync(mp3Path).size >= 1024) {
    return { absPath: mp3Path, urlPath: `/uploads/audio/ambient-jazz/${base}.mp3`, mimeType: 'audio/mpeg' };
  }
  return { absPath: wavPath, urlPath: `/uploads/audio/ambient-jazz/${base}.wav`, mimeType: 'audio/wav' };
}

function defaultHomeSettings() {
  return {
    brandName: 'GlobusMarket',
    locationText: 'Toshkent shahri',
    searchPlaceholder: 'Mahsulot qidirish...',
    heroTitle: 'Tez va ishonchli yetkazib berish',
    heroSubtitle: 'Sifatli mahsulotlar eng yaxshi narxlarda',
    heroBadgeText: '20-30 daqiqa',
    bonusTitle: 'Har kuni aksiya',
    bonusSubtitle: 'Yangi chegirmalar siz uchun',
    deliveryTimeText: '30 daqiqa',
    deliveryText: 'Buyurtma uyingizgacha',
    backgroundImageUrl: '',
    accentColor: '#6a4dff',
    defaultMarginPercent: 15,
    clickPaymentUrl: '',
    paymePaymentUrl: '',
    cashTermsText: 'Naqd to‘lovni qabul qilaman.'
  };
}

const DEMO_BANNER_IMAGE =
  'https://picsum.photos/seed/globusmarket-banner-demo/1200/520';

const DEMO_SHORT_PRIMARY_MP4 =
  'https://storage.googleapis.com/exoplayer-test-media-1/mp4/android-screens-10s.mp4';

const DEMO_SHORT_SECOND_MP4 =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

async function ensureAppState() {
  const hs = defaultHomeSettings();
  await prisma.appState.upsert({
    where: { id: 'main' },
    create: {
      id: 'main',
      homeSettings: hs,
      adminV2Theme: {
        primaryColor: hs.accentColor,
        accentColor: hs.accentColor,
        radiusPx: 16
      },
      shortsRevision: 0
    },
    update: {}
  });
}

async function seedCategories() {
  await prisma.category.upsert({
    where: { slug: 'sut-mahsulotlari' },
    create: {
      id: 'demo_cat_dairy',
      name: 'Sut mahsulotlari',
      slug: 'sut-mahsulotlari',
      displayName: 'Sut mahsulotlari',
      icon: '🥛',
      imageUrl: '',
      active: true
    },
    update: {
      name: 'Sut mahsulotlari',
      displayName: 'Sut mahsulotlari',
      icon: '🥛',
      active: true
    }
  });

  await prisma.category.upsert({
    where: { slug: 'non-va-hamir' },
    create: {
      id: 'demo_cat_bakery',
      name: 'Non va hamir',
      slug: 'non-va-hamir',
      displayName: 'Non va hamir',
      icon: '🥖',
      imageUrl: '',
      active: true
    },
    update: {
      name: 'Non va hamir',
      displayName: 'Non va hamir',
      icon: '🥖',
      active: true
    }
  });

  await prisma.category.upsert({
    where: { slug: 'oziq-ovqat' },
    create: {
      id: 'demo_cat_grocery',
      name: 'Oziq-ovqat',
      slug: 'oziq-ovqat',
      displayName: 'Oziq-ovqat',
      icon: '🛒',
      imageUrl: '',
      active: true
    },
    update: {
      name: 'Oziq-ovqat',
      displayName: 'Oziq-ovqat',
      icon: '🛒',
      active: true
    }
  });
}

async function seedProducts() {
  const dairy = await prisma.category.findUnique({ where: { slug: 'sut-mahsulotlari' } });
  const bakery = await prisma.category.findUnique({ where: { slug: 'non-va-hamir' } });
  const grocery = await prisma.category.findUnique({ where: { slug: 'oziq-ovqat' } });
  if (!dairy || !bakery || !grocery) throw new Error('[seed] categories missing');

  const rows = [
    {
      id: 'demo_prod_milk_1l',
      barcode: 'MILK-1L',
      name: 'Sut 1L',
      price: 14000,
      stock: 90,
      categoryId: dairy.id,
      imageUrl: '',
      active: true,
      oldPrice: 16000,
      discountPercent: 12
    },
    {
      id: 'demo_prod_kefir_1l',
      barcode: 'KEFIR-1L',
      name: 'Kefir 1L',
      price: 18000,
      stock: 70,
      categoryId: dairy.id,
      imageUrl: '',
      active: true,
      oldPrice: 0,
      discountPercent: 0
    },
    {
      id: 'demo_prod_yogurt_150',
      barcode: 'YOG-150',
      name: 'Yogurt 150g',
      price: 6500,
      stock: 120,
      categoryId: dairy.id,
      imageUrl: '',
      active: true,
      oldPrice: 7500,
      discountPercent: 13
    },
    {
      id: 'demo_prod_butter_200',
      barcode: 'BUTTER-200',
      name: 'Saryog‘ 200g',
      price: 28000,
      stock: 45,
      categoryId: dairy.id,
      imageUrl: '',
      active: true,
      oldPrice: 0,
      discountPercent: 0
    },
    {
      id: 'demo_prod_bread_patir',
      barcode: 'BRD-PATIR',
      name: 'Issiq non (patir)',
      price: 5500,
      stock: 60,
      categoryId: bakery.id,
      imageUrl: '',
      active: true,
      oldPrice: 6000,
      discountPercent: 8
    },
    {
      id: 'demo_prod_eggs_10',
      barcode: 'EGG-10',
      name: 'Tuxum (10 dona)',
      price: 22000,
      stock: 40,
      categoryId: grocery.id,
      imageUrl: '',
      active: true,
      oldPrice: 0,
      discountPercent: 0
    }
  ];

  for (const p of rows) {
    const existing = await prisma.product.findFirst({ where: { barcode: p.barcode } });
    const payload = {
      barcode: p.barcode,
      name: p.name,
      price: p.price,
      stock: p.stock,
      categoryId: p.categoryId,
      imageUrl: p.imageUrl,
      active: p.active,
      oldPrice: p.oldPrice,
      discountPercent: p.discountPercent
    };
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.product.create({ data: { id: p.id, ...payload } });
    }
  }
}

async function seedBanners() {
  const banners = [
    {
      id: 'demo_banner_delivery',
      title: 'Tez yetkazib berish',
      subtitle: '20–30 daqiqada uyingizgacha',
      badge: 'Yangi',
      imageUrl: DEMO_BANNER_IMAGE,
      link: '',
      active: true,
      sortOrder: 0
    },
    {
      id: 'demo_banner_weekly',
      title: 'Haftalik chegirmalar',
      subtitle: 'Tanlangan mahsulotlarga maxsus narxlar',
      badge: '-15%',
      imageUrl: DEMO_BANNER_IMAGE,
      link: '',
      active: true,
      sortOrder: 1
    }
  ];
  for (const b of banners) {
    await prisma.banner.upsert({
      where: { id: b.id },
      create: b,
      update: {
        title: b.title,
        subtitle: b.subtitle,
        badge: b.badge,
        imageUrl: b.imageUrl,
        link: b.link,
        active: b.active,
        sortOrder: b.sortOrder
      }
    });
  }
}

function titleFromShortFilename(file) {
  const base = path.basename(file, path.extname(file));
  const cleaned = base.replace(/^short_\d+_[^_]+_/i, '').replace(/[_-]+/g, ' ').trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : base;
}

async function seedShorts() {
  const diskRows = [];
  if (fs.existsSync(SHORTS_UPLOAD_DIR)) {
    const files = fs
      .readdirSync(SHORTS_UPLOAD_DIR)
      .filter((f) => /\.(mp4|webm)$/i.test(f))
      .sort();
    files.forEach((file, idx) => {
      diskRows.push({
        id: `seed_short_${file.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        title: titleFromShortFilename(file),
        subtitle: '',
        videoUrl: `/uploads/shorts/${file}`,
        thumbnailUrl: '',
        active: true,
        sortOrder: idx
      });
    });
  }

  const demoOffset = diskRows.length;
  const demos = [
    {
      id: 'demo_short_vertical_clip',
      title: 'GlobusMarket ga qisqa sayohat',
      subtitle: 'Demo vertical clip',
      videoUrl: DEMO_SHORT_PRIMARY_MP4,
      thumbnailUrl: 'https://picsum.photos/seed/gmdemo-short-a/720/1280',
      active: true,
      sortOrder: demoOffset
    },
    {
      id: 'demo_short_sample_md',
      title: 'Yangi mahsulotlar',
      subtitle: 'Namuna video',
      videoUrl: DEMO_SHORT_SECOND_MP4,
      thumbnailUrl: 'https://picsum.photos/seed/gmdemo-short-b/720/1280',
      active: true,
      sortOrder: demoOffset + 1
    }
  ];

  const shorts = [...diskRows, ...demos];
  for (const s of shorts) {
    await prisma.short.upsert({
      where: { id: s.id },
      create: s,
      update: {
        title: s.title,
        subtitle: s.subtitle,
        videoUrl: s.videoUrl,
        thumbnailUrl: s.thumbnailUrl,
        active: s.active,
        sortOrder: s.sortOrder
      }
    });
  }
}

async function seedAmbientTracks() {
  const now = new Date();
  for (const { slot, fileName, diskFile } of ADMIN_AMBIENT_SLOTS) {
    const adminAbs = path.join(ADMIN_AMBIENT_DIR, diskFile);
    let absPath;
    let urlPath;
    let mimeType;

    if (fs.existsSync(adminAbs) && fs.statSync(adminAbs).size >= 1024) {
      absPath = adminAbs;
      urlPath = `/uploads/audio/admin-ambient/${diskFile}`;
      mimeType = 'audio/mpeg';
    } else {
      console.warn(`[seed] missing or tiny admin-ambient file ${diskFile}, using ambient-jazz fallback for slot ${slot}`);
      const fb = ambientFileForSlot(slot);
      absPath = fb.absPath;
      urlPath = fb.urlPath;
      mimeType = fb.mimeType;
    }

    const stat = fs.statSync(absPath);
    await prisma.ambientTrack.upsert({
      where: { slot },
      create: {
        slot,
        fileName,
        fileUrl: urlPath,
        mimeType,
        fileSize: stat.size,
        updatedAt: now
      },
      update: {
        fileName,
        fileUrl: urlPath,
        mimeType,
        fileSize: stat.size,
        updatedAt: now
      }
    });
  }
}

async function main() {
  await ensureAppState();
  await seedCategories();
  await seedProducts();
  await seedBanners();
  await seedShorts();
  await seedAmbientTracks();

  const [c, p, b, sh, amb] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.banner.count(),
    prisma.short.count(),
    prisma.ambientTrack.count()
  ]);
  console.log('[seed] upserted demo catalog:', {
    categories: c,
    products: p,
    banners: b,
    shorts: sh,
    ambientTracks: amb
  });
}

main()
  .catch((e) => {
    console.error('[seed] failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
