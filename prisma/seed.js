const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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

async function main() {
  const catCount = await prisma.category.count();
  if (catCount > 0) {
    console.log('[seed] skipped — catalog already present');
    return;
  }

  const hs = defaultHomeSettings();
  const appRow = await prisma.appState.findUnique({ where: { id: 'main' } });
  if (!appRow) {
    await prisma.appState.create({
      data: {
        id: 'main',
        homeSettings: hs,
        adminV2Theme: {
          primaryColor: hs.accentColor,
          accentColor: hs.accentColor,
          radiusPx: 16
        },
        shortsRevision: 0
      }
    });
  }

  const category = await prisma.category.create({
    data: {
      name: 'Sut mahsulotlari',
      slug: 'sut-mahsulotlari',
      displayName: 'Sut mahsulotlari',
      icon: '🥛',
      imageUrl: '',
      active: true
    }
  });

  await prisma.product.createMany({
    data: [
      {
        barcode: 'MILK-1L',
        name: 'Sut 1L',
        price: 14000,
        stock: 90,
        categoryId: category.id,
        imageUrl: '',
        active: true,
        oldPrice: 16000,
        discountPercent: 12
      },
      {
        barcode: 'KEFIR',
        name: 'Kefir 1L',
        price: 18000,
        stock: 70,
        categoryId: category.id,
        imageUrl: '',
        active: true,
        oldPrice: 0,
        discountPercent: 0
      }
    ]
  });

  await prisma.banner.create({
    data: {
      title: 'Tez yetkazib berish',
      subtitle: '20-30 daqiqada',
      imageUrl: '',
      link: '',
      active: true,
      sortOrder: 0
    }
  });

  console.log('[seed] created category, 2 products, 1 banner');
}

main()
  .catch((e) => {
    console.error('[seed] failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
