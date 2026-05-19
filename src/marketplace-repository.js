const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('./prisma-client');

const APP_ID = 'main';

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

function defaultAdminV2Theme(homeSettings) {
  const accent = String(homeSettings?.accentColor || '#6a4dff').trim() || '#6a4dff';
  return {
    primaryColor: accent,
    accentColor: accent,
    radiusPx: 16
  };
}

async function ensureAppState() {
  try {
    let row = await prisma.appState.findUnique({ where: { id: APP_ID } });
    if (!row) {
      const hs = defaultHomeSettings();
      row = await prisma.appState.create({
        data: {
          id: APP_ID,
          homeSettings: hs,
          adminV2Theme: defaultAdminV2Theme(hs),
          shortsRevision: 0
        }
      });
    }
    return row;
  } catch (err) {
    if (err && err.code === 'P2021') {
      console.error(
        '[DB] Schema out of date (table missing, Prisma P2021). Run: prisma migrate deploy'
      );
    }
    throw err;
  }
}

async function getHomeSettingsJson() {
  const row = await ensureAppState();
  return row.homeSettings;
}

async function mergeHomeSettings(patch) {
  const row = await ensureAppState();
  const next = { ...(row.homeSettings || {}), ...patch };
  await prisma.appState.update({
    where: { id: APP_ID },
    data: { homeSettings: next }
  });
  return next;
}

async function getAdminV2ThemeJson() {
  const row = await ensureAppState();
  let theme = row.adminV2Theme;
  if (!theme || typeof theme !== 'object') {
    theme = defaultAdminV2Theme(row.homeSettings);
    await prisma.appState.update({ where: { id: APP_ID }, data: { adminV2Theme: theme } });
  }
  return theme;
}

async function setAdminV2ThemeJson(theme) {
  await prisma.appState.update({
    where: { id: APP_ID },
    data: { adminV2Theme: theme }
  });
  return theme;
}

async function getShortsRevision() {
  const row = await ensureAppState();
  const n = Number(row.shortsRevision);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function bumpShortsRevision() {
  const row = await ensureAppState();
  const next = (Number(row.shortsRevision) || 0) + 1;
  await prisma.appState.update({
    where: { id: APP_ID },
    data: { shortsRevision: next }
  });
  return next;
}

function orderLineToCartItem(li) {
  return {
    id: li.productId,
    name: li.productName,
    price: li.price,
    quantity: li.quantity,
    subtotal: li.price * li.quantity,
    image_url: li.imageUrl || ''
  };
}

function orderToLegacy(order, items) {
  const createdIso = order.createdAt.toISOString();
  const updatedIso = order.updatedAt.toISOString();
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    customerAddress: order.deliveryAddress,
    deliveryAddress: order.deliveryAddress,
    location: order.location || '',
    addressText: order.addressText || '',
    landmarkText: order.landmarkText || '',
    locationLat: order.locationLat,
    locationLng: order.locationLng,
    locationAccuracy: order.locationAccuracy ?? 0,
    distanceKm: order.distanceKm,
    distanceValid: order.distanceValid,
    deliveryFallbackApplied: order.deliveryFallbackApplied,
    deliveryPriceCapped: order.deliveryPriceCapped,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    delivery_status: order.deliveryStatus || order.status,
    deliveryEta: order.deliveryEta || '',
    items: items.map(orderLineToCartItem),
    subtotal: order.subtotal,
    deliveryPrice: order.deliveryPrice,
    total: order.total,
    created_at: createdIso,
    updated_at: updatedIso,
    courierName: order.courierName || '',
    courierPhone: order.courierPhone || '',
    courierToken: order.courierToken,
    courierTokenUsed: order.courierTokenUsed,
    courierLocationLat: order.courierLocationLat,
    courierLocationLng: order.courierLocationLng,
    courierLocationAccuracy: order.courierLocationAccuracy,
    courierLocationUpdatedAt: order.courierLocationUpdatedAt
      ? order.courierLocationUpdatedAt.toISOString()
      : null,
    feedbackRating: order.feedbackRating,
    feedbackComment: order.feedbackComment,
    feedbackAt: order.feedbackAt ? order.feedbackAt.toISOString() : undefined,
    trackingUpdatedAt: order.trackingUpdatedAt ? order.trackingUpdatedAt.toISOString() : undefined,
    courierRunId: order.courierRunId || null,
    courierStopSeq: order.courierStopSeq != null ? Number(order.courierStopSeq) : null,
    integrationMeta: order.integrationMeta || null,
    tsdSent: Boolean(
      order.integrationMeta &&
        typeof order.integrationMeta === 'object' &&
        !Array.isArray(order.integrationMeta) &&
        (order.integrationMeta.tsd?.sentAt || order.integrationMeta.tsd?.externalId)
    ),
    tsdExternalId:
      order.integrationMeta &&
      typeof order.integrationMeta === 'object' &&
      !Array.isArray(order.integrationMeta)
        ? order.integrationMeta.tsd?.externalId || null
        : null
  };
}

async function loadOrderLegacy(where) {
  const order = await prisma.order.findFirst({
    where,
    include: { items: true },
    orderBy: { createdAt: 'desc' }
  });
  if (!order) return null;
  return orderToLegacy(order, order.items);
}

async function loadOrderLegacyById(id) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true }
  });
  if (!order) return null;
  return orderToLegacy(order, order.items);
}

/** Lean shape for public catalog JSON (shared by pagination + home rails). */
const PRODUCT_PUBLIC_SELECT = {
  id: true,
  barcode: true,
  name: true,
  price: true,
  oldPrice: true,
  stock: true,
  imageUrl: true,
  active: true,
  categoryId: true,
  discountPercent: true,
  category: { select: { name: true, displayName: true } }
};

function productToPublic(p) {
  const c = p.category;
  return {
    id: p.id,
    code: p.barcode || '',
    name: p.name,
    price: p.price,
    oldPrice: p.oldPrice,
    stock: p.stock,
    image_url: p.imageUrl || '',
    active: p.active,
    categoryId: p.categoryId,
    category: c?.name || '',
    categoryDisplayName: c?.displayName || c?.name || '',
    discount_percent: p.discountPercent
  };
}

/** Smaller JSON for home rails embedded in /home (mobile bandwidth). */
function productToPublicHomeRail(p) {
  const c = p.category;
  return {
    id: p.id,
    code: '',
    name: p.name,
    price: p.price,
    oldPrice: p.oldPrice,
    stock: p.stock,
    image_url: p.imageUrl || '',
    active: p.active,
    categoryId: p.categoryId,
    category: c?.name || '',
    categoryDisplayName: c?.displayName || c?.name || '',
    discount_percent: p.discountPercent
  };
}

async function findProductById(id) {
  return prisma.product.findFirst({
    where: { id: String(id) },
    include: { category: true }
  });
}

async function listProductsPublic() {
  const products = await prisma.product.findMany({
    where: {},
    include: { category: true },
    orderBy: { createdAt: 'asc' }
  });
  return products.map(productToPublic);
}

function normalizePublicProductSort(sortRaw) {
  const s = String(sortRaw || '')
    .trim()
    .toLowerCase();
  if (s === 'price_asc' || s === 'cheap' || s === 'arzon') return 'price_asc';
  if (s === 'price_desc' || s === 'expensive' || s === 'qimmat') return 'price_desc';
  if (s === 'popular' || s === 'pop' || s === 'ommabop') return 'popular';
  return 'default';
}

function orderByForPublicProductSort(sortKey) {
  switch (sortKey) {
    case 'price_asc':
      return { price: 'asc' };
    case 'price_desc':
      return { price: 'desc' };
    case 'popular':
      return [{ discountPercent: 'desc' }, { stock: 'desc' }, { createdAt: 'desc' }];
    default:
      return { createdAt: 'asc' };
  }
}

async function listProductsPublicPage({
  page,
  limit,
  includeTotal = false,
  sort: sortRaw,
  categoryId: categoryIdRaw
} = {}) {
  const pg = Math.max(1, Number(page) || 1);
  const lim = Math.max(1, Math.min(100, Number(limit) || 40));
  const skip = (pg - 1) * lim;
  const sortKey = normalizePublicProductSort(sortRaw);
  const cid = String(categoryIdRaw || '').trim();
  const categoryId =
    cid.length >= 12 && /^[a-z0-9_-]+$/i.test(cid) ? cid : null;

  const where = { active: true };
  if (categoryId) {
    where.categoryId = categoryId;
  }

  const rows = await prisma.product.findMany({
    where,
    select: PRODUCT_PUBLIC_SELECT,
    orderBy: orderByForPublicProductSort(sortKey),
    skip,
    take: lim + 1
  });
  const hasMore = rows.length > lim;
  const pageRows = hasMore ? rows.slice(0, lim) : rows;
  const items = pageRows.map(productToPublic);
  let total;
  if (includeTotal) {
    total = await prisma.product.count({ where });
  }
  return {
    items,
    total,
    page: pg,
    limit: lim,
    hasMore
  };
}

/**
 * Home “rails” — same pattern as large marketplaces: small indexed reads on the server,
 * no sorting thousands of rows in the browser. Rows do not repeat across sections.
 */
async function listHomeCatalogRails() {
  const nFeatured = 12;
  const nDisc = 6;
  const nStock = 6;
  const nNew = 6;

  const featuredRows = await prisma.product.findMany({
    where: { active: true },
    select: PRODUCT_PUBLIC_SELECT,
    orderBy: [{ stock: 'desc' }, { createdAt: 'asc' }],
    take: nFeatured
  });

  const used = new Set(featuredRows.map((r) => r.id));

  const excludeSql = (idsSet) => {
    const arr = [...idsSet];
    if (!arr.length) return Prisma.sql``;
    return Prisma.sql`AND id NOT IN (${Prisma.join(arr.map((id) => Prisma.sql`${id}`))})`;
  };

  const discountedIdRows = await prisma.$queryRaw`
    SELECT id FROM "Product"
    WHERE active = true AND "oldPrice" > price
    ${excludeSql(used)}
    ORDER BY ("oldPrice" - price) DESC
    LIMIT ${nDisc}
  `;

  for (const r of discountedIdRows) used.add(r.id);

  const inStockRows = await prisma.product.findMany({
    where: {
      active: true,
      stock: { gt: 0 },
      ...(used.size ? { id: { notIn: [...used] } } : {})
    },
    select: PRODUCT_PUBLIC_SELECT,
    orderBy: [{ stock: 'desc' }, { createdAt: 'asc' }],
    take: nStock
  });

  for (const r of inStockRows) used.add(r.id);

  const newRows = await prisma.product.findMany({
    where: {
      active: true,
      ...(used.size ? { id: { notIn: [...used] } } : {})
    },
    select: PRODUCT_PUBLIC_SELECT,
    orderBy: { createdAt: 'desc' },
    take: nNew
  });

  const discIds = discountedIdRows.map((r) => r.id);
  let discountedPublic = [];
  if (discIds.length) {
    const discountedRows = await prisma.product.findMany({
      where: { id: { in: discIds }, active: true },
      select: PRODUCT_PUBLIC_SELECT
    });
    const order = new Map(discIds.map((id, i) => [id, i]));
    discountedPublic = [...discountedRows]
      .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
      .map(productToPublicHomeRail);
  }

  return {
    featured: featuredRows.map(productToPublicHomeRail),
    discounted: discountedPublic,
    inStock: inStockRows.map(productToPublicHomeRail),
    newArrivals: newRows.map(productToPublicHomeRail)
  };
}

async function listCategoriesForAdmin() {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  const counts = await prisma.product.groupBy({
    by: ['categoryId'],
    _count: { categoryId: true }
  });
  const map = new Map(counts.map((c) => [c.categoryId, c._count.categoryId]));
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    displayName: c.displayName || c.name,
    icon: c.icon || '',
    image_url: c.imageUrl || '',
    active: c.active,
    productCount: map.get(c.id) || 0
  }));
}

async function updateCategory(id, patch) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return null;
  const p = { ...(patch || {}) };
  if (p.image_url !== undefined && p.imageUrl === undefined) {
    p.imageUrl = p.image_url;
  }
  const allowed = ['displayName', 'icon', 'imageUrl', 'active', 'name'];
  const data = {};
  for (const k of allowed) {
    if (p[k] !== undefined) data[k] = p[k];
  }
  if (!Object.keys(data).length) {
    return {
      id: existing.id,
      name: existing.name,
      displayName: existing.displayName || existing.name,
      icon: existing.icon || '',
      image_url: existing.imageUrl || '',
      active: existing.active
    };
  }
  const updated = await prisma.category.update({ where: { id }, data });
  return {
    id: updated.id,
    name: updated.name,
    displayName: updated.displayName || updated.name,
    icon: updated.icon || '',
    image_url: updated.imageUrl || '',
    active: updated.active
  };
}

async function listAdminProducts(search) {
  const q = String(search || '').trim().toLowerCase();
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { name: 'asc' }
  });
  const mapped = products.map(productToPublic);
  if (!q) return mapped;
  return mapped.filter((p) =>
    `${p.name} ${p.code} ${p.category}`.toLowerCase().includes(q));
}

async function updateProduct(id, body) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return null;
  const categoryId = String(body.categoryId ?? existing.categoryId);
  const updated = await prisma.product.update({
    where: { id },
    data: {
      barcode: body.code !== undefined ? String(body.code || '').trim() : existing.barcode,
      name: body.name !== undefined ? String(body.name) : existing.name,
      price:
        body.price !== undefined && Number.isFinite(Number(body.price))
          ? Math.round(Number(body.price))
          : existing.price,
      stock:
        body.stock !== undefined && Number.isFinite(Number(body.stock))
          ? Math.max(0, Math.round(Number(body.stock)))
          : existing.stock,
      imageUrl: body.image_url !== undefined ? String(body.image_url || '') : existing.imageUrl,
      active: body.active !== undefined ? Boolean(body.active) : existing.active,
      oldPrice:
        body.oldPrice !== undefined && Number.isFinite(Number(body.oldPrice))
          ? Math.round(Number(body.oldPrice))
          : existing.oldPrice,
      discountPercent:
        body.discount_percent !== undefined && Number.isFinite(Number(body.discount_percent))
          ? Math.max(0, Math.min(100, Math.round(Number(body.discount_percent))))
          : existing.discountPercent,
      categoryId
    },
    include: { category: true }
  });
  return productToPublic(updated);
}

async function getCartLines(phone) {
  return prisma.cartLine.findMany({ where: { userPhone: phone } });
}

async function setCartQuantity(phone, productId, quantity) {
  if (quantity <= 0) {
    await prisma.cartLine.deleteMany({ where: { userPhone: phone, productId } });
    return;
  }
  await prisma.cartLine.upsert({
    where: {
      userPhone_productId: { userPhone: phone, productId }
    },
    create: { userPhone: phone, productId, quantity },
    update: { quantity }
  });
}

async function clearCart(phone) {
  await prisma.cartLine.deleteMany({ where: { userPhone: phone } });
}

async function getUserProfile(phone) {
  return prisma.user.findUnique({ where: { phone } });
}

async function upsertUserProfile(phone, data) {
  const existing = await prisma.user.findUnique({ where: { phone } });
  const updateData = {
    name: data.name,
    updatedAt: new Date()
  };
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.biometric !== undefined) updateData.biometric = data.biometric;
  if (data.notificationsRead !== undefined) updateData.notificationsRead = data.notificationsRead;

  if (existing) {
    return prisma.user.update({ where: { phone }, data: updateData });
  }

  const createBase = {
    phone,
    name: data.name,
    role: 'customer',
    firstName: data.firstName ?? null,
    lastName: data.lastName ?? null,
    address: data.address ?? null,
    updatedAt: new Date()
  };
  if (data.biometric !== undefined) createBase.biometric = data.biometric;
  if (data.notificationsRead !== undefined) createBase.notificationsRead = data.notificationsRead;

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const agg = await tx.user.aggregate({ _max: { customerNo: true } });
        const nextNo = (agg._max.customerNo ?? 0) + 1;
        return tx.user.create({
          data: { ...createBase, customerNo: nextNo }
        });
      });
    } catch (e) {
      if (e?.code === 'P2002' && attempt < 5) continue;
      throw e;
    }
  }
}

async function readSmsChallenge(phone) {
  return prisma.smsOtpChallenge.findUnique({ where: { phone } });
}

async function writeSmsChallenge(phone, row) {
  const exp =
    row.expiresAt instanceof Date ? row.expiresAt : new Date(Number(row.expiresAt));
  await prisma.smsOtpChallenge.upsert({
    where: { phone },
    create: {
      phone,
      codeHash: row.codeHash,
      expiresAt: exp,
      attempts: row.attempts || 0,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date()
    },
    update: {
      codeHash: row.codeHash,
      expiresAt: exp,
      attempts: row.attempts ?? 0
    }
  });
}

async function deleteSmsChallenge(phone) {
  try {
    await prisma.smsOtpChallenge.delete({ where: { phone } });
  } catch (_) {}
}

/** GDPR-style account removal: user + cart + OTP; orders anonymized for bookkeeping. */
async function deleteCustomerAccount(phone) {
  const normalized = String(phone || '').trim();
  if (!normalized) return { ok: false, deleted: false };
  const user = await prisma.user.findUnique({ where: { phone: normalized } });
  if (!user) return { ok: true, deleted: false };
  const anonPhone = `deleted_${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 20)}`;
  await prisma.$transaction(async (tx) => {
    await tx.cartLine.deleteMany({ where: { userPhone: normalized } });
    try {
      await tx.smsOtpChallenge.delete({ where: { phone: normalized } });
    } catch (_) {}
    await tx.order.updateMany({
      where: { customerPhone: normalized },
      data: {
        customerPhone: anonPhone,
        customerName: 'Deleted account',
        deliveryAddress: '',
        addressText: '',
        landmarkText: '',
        location: '',
        locationLat: null,
        locationLng: null,
        locationAccuracy: null,
        feedbackComment: null
      }
    });
    await tx.user.delete({ where: { phone: normalized } });
  });
  return { ok: true, deleted: true, biometric: user.biometric || null };
}

async function touchSmsAttempt(phone, attempts) {
  await prisma.smsOtpChallenge.update({
    where: { phone },
    data: { attempts }
  });
}

async function nextOrderNumber() {
  const count = await prisma.order.count();
  return String(100000 + count + 1);
}

async function createOrderWithItems(orderData, itemRows) {
  return prisma.order.create({
    data: {
      ...orderData,
      items: {
        create: itemRows
      }
    },
    include: { items: true }
  });
}

async function listOrdersLegacySorted() {
  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { updatedAt: 'desc' }
  });
  return orders.map((o) => orderToLegacy(o, o.items));
}

async function listOrdersForFeed() {
  return listOrdersLegacySorted();
}

async function findOrderWithItems(where) {
  return prisma.order.findFirst({
    where,
    include: { items: true }
  });
}

/** Partial update; omit undefined fields. Does not replace order lines. */
async function patchOrderScalars(orderId, data) {
  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: cleaned,
    include: { items: true }
  });
  return orderToLegacy(updated, updated.items);
}

/** Payme Merchant API: resolve order by `orderNumber` or internal id (Payme account.order_id). */
async function findOrderForPayme(accountKey) {
  const key = String(accountKey || '')
    .trim()
    .replace(/^"+|"+$/g, '');
  if (!key || !String(process.env.DATABASE_URL || '').trim()) return null;
  return prisma.order.findFirst({
    where: {
      OR: [{ orderNumber: key }, { id: key }],
      paymentMethod: 'payme',
      paymentStatus: { notIn: ['paid'] },
      status: { in: ['created', 'payment_pending'] }
    }
  });
}

async function paymeMarkOrderPaid(orderId) {
  await prisma.order.updateMany({
    where: { id: String(orderId) },
    data: { paymentStatus: 'paid', status: 'payment_confirmed' }
  });
}

/** Called when Payme cancels before settlement — keeps checkout payable again. */
async function paymeMarkOrderPaymentPending(orderId) {
  await prisma.order.updateMany({
    where: { id: String(orderId), paymentStatus: { not: 'paid' } },
    data: { paymentStatus: 'pending' }
  });
}

async function replaceOrderLines(orderId, items) {
  const creates = (items || []).map((it) => ({
    productId: String(it.id || it.productId),
    productName: String(it.name || ''),
    quantity: Math.max(0, Number(it.quantity || 0)),
    price: Math.round(Number(it.price || 0)),
    imageUrl: String(it.image_url || '')
  }));
  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId } });
    await tx.order.update({
      where: { id: orderId },
      data: {
        items: { create: creates }
      }
    });
  });
  return loadOrderLegacyById(orderId);
}

async function bumpShortsBroadcastRepo(shortApi) {
  const rev = await bumpShortsRevision();
  await appendShortsNotification(shortApi, rev);
}

async function listBannersOrdered() {
  return prisma.banner.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
}

function bannerToApi(b) {
  return {
    id: b.id,
    title: b.title,
    subtitle: b.subtitle || '',
    badge: b.badge || '',
    link_url: b.link || '',
    image_url: b.imageUrl || '',
    active: b.active
  };
}

async function createBannerApiShape(body) {
  const minSort = await prisma.banner.findFirst({ orderBy: { sortOrder: 'asc' }, select: { sortOrder: true } });
  const sortOrder = minSort ? minSort.sortOrder - 1 : 0;
  const b = await prisma.banner.create({
    data: {
      title: String(body.title || '').trim(),
      subtitle: String(body.subtitle || '').trim(),
      badge: String(body.badge || '').trim(),
      link: String(body.link_url || '').trim(),
      imageUrl: String(body.image_url || '').trim(),
      active: body.active !== false,
      sortOrder
    }
  });
  return bannerToApi(b);
}

async function reorderBanners(ids) {
  const banners = await prisma.banner.findMany();
  const byId = new Map(banners.map((b) => [String(b.id), b]));
  const ordered = [];
  ids.forEach((rid) => {
    const b = byId.get(String(rid));
    if (b) ordered.push(b);
  });
  banners.forEach((b) => {
    if (!ordered.find((x) => x.id === b.id)) ordered.push(b);
  });
  let i = 0;
  for (const b of ordered) {
    await prisma.banner.update({ where: { id: b.id }, data: { sortOrder: i } });
    i += 1;
  }
  return (await listBannersOrdered()).map(bannerToApi);
}

async function updateBanner(id, body) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) return null;
  const b = await prisma.banner.update({
    where: { id },
    data: {
      title: body.title !== undefined ? String(body.title) : undefined,
      subtitle: body.subtitle !== undefined ? String(body.subtitle) : undefined,
      badge: body.badge !== undefined ? String(body.badge) : undefined,
      link: body.link_url !== undefined ? String(body.link_url) : undefined,
      imageUrl: body.image_url !== undefined ? String(body.image_url) : undefined,
      active: body.active !== undefined ? body.active !== false : undefined
    }
  });
  return bannerToApi(b);
}

async function deleteBanner(id) {
  await prisma.banner.deleteMany({ where: { id } });
}

async function listPromotionsApi() {
  const rows = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    discount_text: p.discountText,
    description: p.description,
    image_url: p.imageUrl,
    active: p.active
  }));
}

async function createPromotionApi(body) {
  const p = await prisma.promotion.create({
    data: {
      title: String(body.title || '').trim(),
      discountText: String(body.discount_text || '').trim(),
      description: String(body.description || '').trim(),
      imageUrl: String(body.image_url || '').trim(),
      active: body.active !== false
    }
  });
  return {
    id: p.id,
    title: p.title,
    discount_text: p.discountText,
    description: p.description,
    image_url: p.imageUrl,
    active: p.active
  };
}

async function updatePromotion(id, body) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) return null;
  const p = await prisma.promotion.update({
    where: { id },
    data: {
      title: body.title !== undefined ? String(body.title) : undefined,
      discountText: body.discount_text !== undefined ? String(body.discount_text) : undefined,
      description: body.description !== undefined ? String(body.description) : undefined,
      imageUrl: body.image_url !== undefined ? String(body.image_url) : undefined,
      active: body.active !== undefined ? body.active !== false : undefined
    }
  });
  return {
    id: p.id,
    title: p.title,
    discount_text: p.discountText,
    description: p.description,
    image_url: p.imageUrl,
    active: p.active
  };
}

async function deletePromotion(id) {
  await prisma.promotion.deleteMany({ where: { id } });
}

function inferShortMimeTypeFromMediaUrl(url) {
  const u = String(url || '').trim().toLowerCase();
  if (!u) return '';
  if (/\.(jpe?g|png|gif|webp)(\?|#|$)/.test(u)) return 'image/jpeg';
  if (/\.webm(\?|#|$)/.test(u)) return 'video/webm';
  if (/\.mov(\?|#|$)/.test(u)) return 'video/quicktime';
  if (/\.(mp4|m4v)(\?|#|$)/.test(u)) return 'video/mp4';
  if (u.includes('/shorts/')) return 'video/mp4';
  if (u.includes('/uploads/shorts/')) return 'video/mp4';
  try {
    const host = new URL(u).hostname.toLowerCase();
    if (host.endsWith('.r2.dev') || host.includes('r2.cloudflarestorage.com')) return 'video/mp4';
  } catch (_) {
    /* ignore */
  }
  // Remote URL without extension (custom R2 domain / CDN): assume video reel
  if (u.startsWith('http://') || u.startsWith('https://')) return 'video/mp4';
  return '';
}

async function listShortsApi() {
  const rows = await prisma.short.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
  });
  return rows.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    media_url: s.videoUrl,
    thumbnail_url: s.thumbnailUrl,
    mime_type: inferShortMimeTypeFromMediaUrl(s.videoUrl),
    active: s.active,
    sortOrder: s.sortOrder,
    view_count: typeof s.viewCount === 'number' ? s.viewCount : 0
  }));
}

async function recordShortViewEvent(shortId, viewerPhone) {
  const sid = String(shortId || '').trim();
  if (!sid) return null;
  const phoneNorm =
    viewerPhone !== undefined && viewerPhone !== null && String(viewerPhone).trim()
      ? String(viewerPhone).trim()
      : null;
  try {
    const row = await prisma.short.findUnique({
      where: { id: sid },
      select: { active: true }
    });
    if (!row || row.active === false) return null;
    await prisma.$transaction([
      prisma.short.update({
        where: { id: sid },
        data: { viewCount: { increment: 1 } }
      }),
      prisma.shortViewLog.create({
        data: { shortId: sid, viewerPhone: phoneNorm }
      })
    ]);
    return true;
  } catch {
    return null;
  }
}

async function listShortViewLogs(shortId, limit) {
  const sid = String(shortId || '').trim();
  const lim = Math.min(200, Math.max(1, Number(limit) || 80));
  const rows = await prisma.shortViewLog.findMany({
    where: { shortId: sid },
    orderBy: { createdAt: 'desc' },
    take: lim,
    select: { viewerPhone: true, createdAt: true }
  });
  return rows.map((r) => ({
    viewer_phone: r.viewerPhone || '',
    at: r.createdAt.toISOString()
  }));
}

async function listCustomersAdmin() {
  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: 'desc' }],
    select: {
      customerNo: true,
      phone: true,
      name: true,
      firstName: true,
      lastName: true,
      address: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      biometric: true
    }
  });
  return users.map((u) => {
    const bio = u.biometric && typeof u.biometric === 'object' ? u.biometric : null;
    return {
      customer_no: u.customerNo,
      phone: u.phone,
      name: u.name,
      first_name: u.firstName || '',
      last_name: u.lastName || '',
      address: u.address || '',
      role: u.role,
      created_at: u.createdAt.toISOString(),
      updated_at: u.updatedAt ? u.updatedAt.toISOString() : null,
      has_biometric: Boolean(bio?.consentGiven && bio?.imageUrl)
    };
  });
}

async function createShortApi(body) {
  const count = await prisma.short.count();
  const s = await prisma.short.create({
    data: {
      title: String(body.title || '').trim(),
      subtitle: String(body.subtitle ?? body.caption ?? '').trim(),
      videoUrl: String(body.media_url || '').trim(),
      thumbnailUrl: String(body.thumbnail_url || '').trim(),
      sortOrder: Number(body.sortOrder || count + 1),
      active: body.active !== false
    }
  });
  return {
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    media_url: s.videoUrl,
    thumbnail_url: s.thumbnailUrl,
    mime_type: inferShortMimeTypeFromMediaUrl(s.videoUrl),
    active: s.active,
    sortOrder: s.sortOrder,
    view_count: typeof s.viewCount === 'number' ? s.viewCount : 0
  };
}

async function reorderShorts(orderRows) {
  for (const row of orderRows) {
    const id = String(row?.id || '');
    const sortOrder = Number(row?.sortOrder);
    if (!id || !Number.isFinite(sortOrder)) continue;
    await prisma.short.updateMany({
      where: { id },
      data: { sortOrder }
    });
  }
  return listShortsApi();
}

async function updateShortApi(id, body) {
  const cur = await prisma.short.findUnique({ where: { id } });
  if (!cur) return null;
  const s = await prisma.short.update({
    where: { id },
    data: {
      title: body.title !== undefined ? String(body.title) : undefined,
      subtitle:
        body.subtitle !== undefined || body.caption !== undefined
          ? String(body.subtitle ?? body.caption ?? '')
          : undefined,
      videoUrl: body.media_url !== undefined ? String(body.media_url) : undefined,
      thumbnailUrl: body.thumbnail_url !== undefined ? String(body.thumbnail_url) : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
      active: body.active !== undefined ? body.active !== false : undefined
    }
  });
  return {
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    media_url: s.videoUrl,
    thumbnail_url: s.thumbnailUrl,
    mime_type: inferShortMimeTypeFromMediaUrl(s.videoUrl),
    active: s.active,
    sortOrder: s.sortOrder,
    view_count: typeof s.viewCount === 'number' ? s.viewCount : 0
  };
}

async function deleteShort(id) {
  await prisma.short.deleteMany({ where: { id } });
}

async function listNotificationsApi() {
  const rows = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' }
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    active: n.active,
    meta: n.meta
  }));
}

async function createNotificationApi(body) {
  const n = await prisma.notification.create({
    data: {
      type: body.type ? String(body.type) : null,
      title: String(body.title || '').trim(),
      body: String(body.body || '').trim(),
      active: body.active !== false,
      meta: body.meta === undefined ? undefined : body.meta
    }
  });
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    active: n.active,
    meta: n.meta
  };
}

async function deleteNotification(id) {
  await prisma.notification.deleteMany({ where: { id } });
}

async function appendShortsNotification(shortApi, revision) {
  const st = String(shortApi.title || '').trim();
  await prisma.notification.create({
    data: {
      type: 'new_shorts',
      title: 'GlobusMarket',
      body: st ? `Yangilik: yangi short — «${st}»` : 'Yangilik: yangi shortlar mavjud',
      active: true,
      meta: { shortId: shortApi.id, shortsRevision: revision }
    }
  });
}

async function listAmbientTracks() {
  const rows = await prisma.ambientTrack.findMany({ orderBy: { slot: 'asc' } });
  return rows.map((r) => ({
    slot: r.slot,
    fileName: r.fileName,
    fileUrl: r.fileUrl,
    mimeType: r.mimeType,
    fileSize: r.fileSize,
    updatedAt: r.updatedAt.toISOString()
  }));
}

async function upsertAmbientTrack(slot, track) {
  await prisma.ambientTrack.upsert({
    where: { slot },
    create: {
      slot,
      fileName: track.fileName,
      fileUrl: track.fileUrl,
      mimeType: track.mimeType,
      fileSize: track.fileSize,
      updatedAt: new Date(track.updatedAt)
    },
    update: {
      fileName: track.fileName,
      fileUrl: track.fileUrl,
      mimeType: track.mimeType,
      fileSize: track.fileSize,
      updatedAt: new Date(track.updatedAt)
    }
  });
}

async function deleteAmbientSlot(slot) {
  await prisma.ambientTrack.deleteMany({ where: { slot } });
}

async function storeSummary() {
  const [categories, products, orders, banners, promotions] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.banner.count(),
    prisma.promotion.count()
  ]);
  return {
    categories,
    products,
    orders,
    banners,
    promotions,
    storageMode: 'postgresql'
  };
}

async function listUsersForBiometricAdmin() {
  const users = await prisma.user.findMany({
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
  });
  return users.map((profile) => {
    const bio = profile.biometric && typeof profile.biometric === 'object' ? profile.biometric : null;
    const updatedAtIso = profile.updatedAt ? profile.updatedAt.toISOString() : null;
    return {
      phone: profile.phone || '',
      name: profile.name || 'Mijoz',
      updatedAt: updatedAtIso,
      biometricStatus: Boolean(bio?.consentGiven && bio?.imageUrl),
      biometric: bio
        ? {
            consentGiven: Boolean(bio.consentGiven),
            consentAt: bio.consentAt || null,
            capturedAt: bio.capturedAt || null,
            imageUrl: bio.imageUrl || '',
            mimeType: bio.mimeType || '',
            fileSize: Number(bio.fileSize || 0)
          }
        : null
    };
  });
}

async function profileToApi(u) {
  if (!u) return null;
  const read =
    u.notificationsRead && typeof u.notificationsRead === 'object'
      ? u.notificationsRead
      : {};
  return {
    phone: u.phone,
    customer_no: typeof u.customerNo === 'number' ? u.customerNo : null,
    name: u.name,
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    address: u.address || '',
    updatedAt: u.updatedAt ? u.updatedAt.toISOString() : undefined,
    biometric: u.biometric || null,
    notificationsRead: read
  };
}

const COURIER_TOKEN_LEN = 64;

function normalizeCourierPortalToken(raw) {
  const t = String(raw || '').trim();
  if (!/^[a-f0-9]+$/i.test(t) || t.length < 32) return '';
  return t.slice(0, COURIER_TOKEN_LEN);
}

async function submitCourierApplication({ phone, fullName, note }) {
  const p = String(phone || '').trim();
  if (!p) throw new Error('phone_required');
  const fn = String(fullName || '').trim().slice(0, 160);
  if (!fn) throw new Error('fullName_required');
  const nt = String(note || '').trim().slice(0, 800);
  const crypto = require('crypto');
  const existing = await prisma.courierApplication.findFirst({
    where: { phone: p },
    orderBy: { createdAt: 'desc' }
  });
  if (existing) {
    const prev = String(existing.status || '').toLowerCase();
    const nextStatus = prev === 'rejected' ? 'pending' : existing.status || 'pending';
    return prisma.courierApplication.update({
      where: { id: existing.id },
      data: {
        fullName: fn,
        note: nt,
        status: nextStatus
      }
    });
  }
  const accessToken = crypto.randomBytes(32).toString('hex');
  return prisma.courierApplication.create({
    data: {
      phone: p,
      fullName: fn,
      note: nt,
      status: 'pending',
      accessToken
    }
  });
}

async function updateCourierApplicationStatusAdmin({ id, status }) {
  const appId = String(id || '').trim();
  if (!appId) throw new Error('id_required');
  const st = String(status || '').trim().toLowerCase();
  if (!['approved', 'rejected', 'pending'].includes(st)) throw new Error('invalid_status');
  return prisma.courierApplication.update({
    where: { id: appId },
    data: { status: st }
  });
}

async function getCourierApplicationByPhone(phone) {
  const p = String(phone || '').trim();
  if (!p) return null;
  return prisma.courierApplication.findFirst({
    where: { phone: p },
    orderBy: { createdAt: 'desc' }
  });
}

async function getCourierApplicationByAccessToken(token) {
  const t = normalizeCourierPortalToken(token);
  if (!t) return null;
  return prisma.courierApplication.findUnique({ where: { accessToken: t } });
}

async function listCourierPortalOrders() {
  const rows = await prisma.order.findMany({
    where: {
      status: { in: ['ready_for_courier', 'courier_assigned', 'out_for_delivery'] }
    },
    orderBy: { updatedAt: 'desc' },
    take: 150,
    include: { items: true }
  });
  return rows.map((o) => orderToLegacy(o, o.items));
}

async function claimOrderByCourierPortalToken({ orderId, accessToken }) {
  const crypto = require('crypto');
  const app = await getCourierApplicationByAccessToken(accessToken);
  if (!app) return { ok: false, code: 'TOKEN', message: 'Token noto‘g‘ri' };
  const id = String(orderId || '').trim();
  if (!id) return { ok: false, code: 'ID', message: 'Buyurtma topilmadi' };
  const phone = String(app.phone || '').trim();
  if (!phone) return { ok: false, code: 'ID', message: 'Telefon topilmadi' };
  const maxBatch = Math.min(20, Math.max(1, Number(process.env.COURIER_MAX_ACTIVE_DELIVERIES || 5) || 5));

  try {
    const done = await prisma.$transaction(async (tx) => {
      const target = await tx.order.findFirst({
        where: { id, status: 'ready_for_courier', courierPhone: '' },
        include: { items: true }
      });
      if (!target) {
        const cur = await tx.order.findUnique({ where: { id }, include: { items: true } });
        if (!cur) return { err: 'NOT_FOUND' };
        const assignedPhone = String(cur.courierPhone || '').trim();
        const st = String(cur.status || '');
        const assignedToMe =
          assignedPhone === phone && ['courier_assigned', 'out_for_delivery'].includes(st);
        if (assignedToMe) return { ok: true, order: orderToLegacy(cur, cur.items) };
        return { err: 'BUSY' };
      }

      const active = await tx.order.findMany({
        where: {
          courierPhone: phone,
          status: { in: ['courier_assigned', 'out_for_delivery'] }
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, courierRunId: true, courierStopSeq: true, createdAt: true }
      });

      if (active.length >= maxBatch) return { err: 'BATCH_FULL' };

      const withRun = active.filter((o) => o.courierRunId);
      let runId;
      if (withRun.length) {
        const freq = new Map();
        for (const o of withRun) {
          const k = String(o.courierRunId);
          freq.set(k, (freq.get(k) || 0) + 1);
        }
        runId = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
      } else {
        runId = crypto.randomUUID();
      }

      const nullRun = active.filter((o) => !o.courierRunId);
      let seqBase = 0;
      if (withRun.length) {
        const inRun = withRun.filter((o) => String(o.courierRunId) === runId);
        seqBase = Math.max(0, ...inRun.map((o) => Number(o.courierStopSeq) || 0));
      }
      let s = seqBase;
      for (const o of nullRun) {
        s += 1;
        await tx.order.update({
          where: { id: o.id },
          data: { courierRunId: runId, courierStopSeq: s, updatedAt: new Date() }
        });
      }

      const maxAgg = await tx.order.aggregate({
        where: {
          courierPhone: phone,
          courierRunId: runId,
          status: { in: ['courier_assigned', 'out_for_delivery'] }
        },
        _max: { courierStopSeq: true }
      });
      const nextSeq = (maxAgg._max.courierStopSeq || 0) + 1;

      const courierToken =
        target.courierToken || `crt_${crypto.randomBytes(6).toString('hex')}`;
      const updated = await tx.order.update({
        where: { id, status: 'ready_for_courier', courierPhone: '' },
        data: {
          courierName: app.fullName,
          courierPhone: phone,
          status: 'courier_assigned',
          deliveryStatus: 'courier_assigned',
          courierRunId: runId,
          courierStopSeq: nextSeq,
          courierToken,
          updatedAt: new Date()
        },
        include: { items: true }
      });

      return { ok: true, order: orderToLegacy(updated, updated.items) };
    });

    if (done.err === 'NOT_FOUND') return { ok: false, code: 'NOT_FOUND', message: 'Buyurtma topilmadi' };
    if (done.err === 'BUSY') {
      return { ok: false, code: 'BUSY', message: 'Buyurtma boshqa kuryerga biriktirilgan yoki status mos emas' };
    }
    if (done.err === 'BATCH_FULL') {
      return {
        ok: false,
        code: 'BATCH_FULL',
        message: `Bir vaqtda ko‘pi bilan ${maxBatch} ta yetkazish. Avvalgilarini yakunlang yoki boshqasiga qoldiring.`
      };
    }
    return done;
  } catch (e) {
    return { ok: false, code: 'BUSY', message: e?.message || 'Buyurtma biriktirilmadi' };
  }
}

async function listCourierRouteOrders({ accessToken }) {
  const app = await getCourierApplicationByAccessToken(accessToken);
  if (!app) return null;
  const phone = String(app.phone || '').trim();
  if (!phone) return [];
  const rows = await prisma.order.findMany({
    where: {
      courierPhone: phone,
      status: { in: ['courier_assigned', 'out_for_delivery'] }
    },
    orderBy: [{ courierStopSeq: 'asc' }, { updatedAt: 'desc' }],
    include: { items: true }
  });
  return rows.map((o) => orderToLegacy(o, o.items));
}

/** Faol yetkazishlar (coords + token) — bir xarita marshruti uchun yengil ro‘yxat */
async function listCourierRouteSliceByCourierToken(courierToken) {
  const t = String(courierToken || '').trim();
  if (!t) return [];
  const central = await prisma.order.findFirst({
    where: { courierToken: t },
    select: { courierRunId: true }
  });
  if (!central?.courierRunId) return [];
  const rows = await prisma.order.findMany({
    where: {
      courierRunId: central.courierRunId,
      status: { in: ['courier_assigned', 'out_for_delivery'] }
    },
    orderBy: [{ courierStopSeq: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      orderNumber: true,
      status: true,
      courierStopSeq: true,
      courierToken: true,
      locationLat: true,
      locationLng: true,
      addressText: true,
      deliveryAddress: true
    }
  });
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    status: r.status,
    courierStopSeq: r.courierStopSeq != null ? Number(r.courierStopSeq) : null,
    courierToken: r.courierToken,
    locationLat: r.locationLat,
    locationLng: r.locationLng,
    addressText: String(r.addressText || r.deliveryAddress || '').trim()
  }));
}

/** Do‘kondan greedy TSP: eng yaqin keyingi nuqta — `courierStopSeq` yangilanadi */
function _haversineKm(lat1, lon1, lat2, lon2) {
  const a1 = Number(lat1);
  const b1 = Number(lon1);
  const a2 = Number(lat2);
  const b2 = Number(lon2);
  if (![a1, b1, a2, b2].every((n) => Number.isFinite(n))) return Infinity;
  const R = 6371;
  const dLat = ((a2 - a1) * Math.PI) / 180;
  const dLon = ((b2 - b1) * Math.PI) / 180;
  const p1 = (a1 * Math.PI) / 180;
  const p2 = (a2 * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(p1) * Math.cos(p2);
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * y;
}

/** Test uchun: nuqtalar ro‘yxatidan greedy tartib (id lar) */
function greedyOrderIdsFromStore(points, storeLat, storeLng) {
  const list = (points || [])
    .map((p) => ({
      id: String(p.id || ''),
      lat: Number(p.lat),
      lng: Number(p.lng)
    }))
    .filter((p) => p.id && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!list.length) return [];
  const remaining = [...list];
  const ordered = [];
  let curLat = Number(storeLat);
  let curLng = Number(storeLng);
  if (!Number.isFinite(curLat) || !Number.isFinite(curLng)) return list.map((p) => p.id);
  while (remaining.length) {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = _haversineKm(curLat, curLng, remaining[i].lat, remaining[i].lng);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    const [next] = remaining.splice(bestI, 1);
    ordered.push(next.id);
    curLat = next.lat;
    curLng = next.lng;
  }
  return ordered;
}

async function repackCourierRunStopsForRunId(runId) {
  const rid = String(runId || '').trim();
  if (!rid) return;
  const active = await prisma.order.findMany({
    where: {
      courierRunId: rid,
      status: { in: ['courier_assigned', 'out_for_delivery'] }
    },
    orderBy: [{ courierStopSeq: 'asc' }, { createdAt: 'asc' }],
    select: { id: true }
  });
  let seq = 1;
  for (const o of active) {
    await prisma.order.update({
      where: { id: o.id },
      data: { courierStopSeq: seq++, updatedAt: new Date() }
    });
  }
}

/** Buyurtmani marshrut guruhi bilan ajratish (admin qayta biriktirish / bekor) */
async function detachOrderFromCourierRun(orderId) {
  const id = String(orderId || '').trim();
  if (!id) return;
  const row = await prisma.order.findUnique({
    where: { id },
    select: { courierRunId: true }
  });
  const runId = row?.courierRunId;
  await prisma.order.update({
    where: { id },
    data: { courierRunId: null, courierStopSeq: null, updatedAt: new Date() }
  });
  if (runId) await repackCourierRunStopsForRunId(runId);
}

async function greedyReorderCourierRunFromStore(runId, storeLat, storeLng) {
  const rid = String(runId || '').trim();
  if (!rid) return { ok: false, message: 'runId kerak' };
  const slat = Number(storeLat);
  const slng = Number(storeLng);
  if (!Number.isFinite(slat) || !Number.isFinite(slng)) return { ok: false, message: 'Do‘kon koordinatasi noto‘g‘ri' };
  const rows = await prisma.order.findMany({
    where: { courierRunId: rid, status: { in: ['courier_assigned', 'out_for_delivery'] } },
    select: { id: true, locationLat: true, locationLng: true }
  });
  const withCoords = rows.filter(
    (r) =>
      r.locationLat != null &&
      r.locationLng != null &&
      Number.isFinite(Number(r.locationLat)) &&
      Number.isFinite(Number(r.locationLng))
  );
  const noCoord = rows.filter((r) => !withCoords.find((w) => w.id === r.id));
  if (!withCoords.length) return { ok: true, updated: 0 };
  const points = withCoords.map((r) => ({ id: r.id, lat: Number(r.locationLat), lng: Number(r.locationLng) }));
  const orderedIds = greedyOrderIdsFromStore(points, slat, slng);
  let seq = 1;
  for (const oid of orderedIds) {
    await prisma.order.update({
      where: { id: oid },
      data: { courierStopSeq: seq++, updatedAt: new Date() }
    });
  }
  for (const r of noCoord) {
    await prisma.order.update({
      where: { id: r.id },
      data: { courierStopSeq: seq++, updatedAt: new Date() }
    });
  }
  return { ok: true, updated: rows.length };
}

async function findNextActiveCourierTokenForPhone(courierPhone) {
  const p = String(courierPhone || '').trim();
  if (!p) return null;
  const row = await prisma.order.findFirst({
    where: {
      courierPhone: p,
      status: { in: ['courier_assigned', 'out_for_delivery'] }
    },
    orderBy: [{ courierStopSeq: 'asc' }, { createdAt: 'asc' }],
    select: { courierToken: true }
  });
  return row?.courierToken ? String(row.courierToken) : null;
}

/** Bitta buyurtma yopilgach, shu `courierRunId` dagi faol stoplarni 1..n qilib qayta raqamlash */
async function repackCourierRunStopsAfterDelivery(deliveredOrderId) {
  const id = String(deliveredOrderId || '').trim();
  if (!id) return;
  const row = await prisma.order.findUnique({
    where: { id },
    select: { courierRunId: true }
  });
  await repackCourierRunStopsForRunId(row?.courierRunId);
}

async function getCourierOpsMetricsSummary() {
  const [activeCourierOrders, readyForCourier, runGroups] = await Promise.all([
    prisma.order.count({
      where: { status: { in: ['courier_assigned', 'out_for_delivery'] } }
    }),
    prisma.order.count({ where: { status: 'ready_for_courier' } }),
    prisma.order.groupBy({
      by: ['courierRunId'],
      where: {
        courierRunId: { not: null },
        status: { in: ['courier_assigned', 'out_for_delivery'] }
      },
      _count: { _all: true }
    })
  ]);
  return {
    activeCourierOrders,
    readyForCourier,
    activeRunsWithOrders: runGroups.length
  };
}

async function listCourierApplicationsAdmin() {
  return prisma.courierApplication.findMany({
    orderBy: { createdAt: 'desc' },
    take: 400
  });
}

async function ensureOrderCourierToken(orderId) {
  const id = String(orderId || '').trim();
  if (!id) return null;
  const row = await prisma.order.findUnique({
    where: { id },
    select: { courierToken: true }
  });
  if (!row) return null;
  if (row.courierToken) return String(row.courierToken);
  const crypto = require('crypto');
  const courierToken = `crt_${crypto.randomBytes(6).toString('hex')}`;
  const next = await prisma.order.update({
    where: { id },
    data: { courierToken },
    select: { courierToken: true }
  });
  return next.courierToken ? String(next.courierToken) : courierToken;
}

module.exports = {
  APP_ID,
  ensureAppState,
  defaultHomeSettings,
  getHomeSettingsJson,
  mergeHomeSettings,
  getAdminV2ThemeJson,
  setAdminV2ThemeJson,
  getShortsRevision,
  bumpShortsRevision,
  loadOrderLegacy,
  loadOrderLegacyById,
  findProductById,
  listProductsPublic,
  listProductsPublicPage,
  listHomeCatalogRails,
  productToPublic,
  listCategoriesForAdmin,
  updateCategory,
  listAdminProducts,
  updateProduct,
  getCartLines,
  setCartQuantity,
  clearCart,
  getUserProfile,
  upsertUserProfile,
  profileToApi,
  submitCourierApplication,
  updateCourierApplicationStatusAdmin,
  getCourierApplicationByPhone,
  getCourierApplicationByAccessToken,
  listCourierPortalOrders,
  claimOrderByCourierPortalToken,
  ensureOrderCourierToken,
  listCourierRouteOrders,
  listCourierRouteSliceByCourierToken,
  repackCourierRunStopsAfterDelivery,
  repackCourierRunStopsForRunId,
  detachOrderFromCourierRun,
  greedyReorderCourierRunFromStore,
  findNextActiveCourierTokenForPhone,
  greedyOrderIdsFromStore,
  getCourierOpsMetricsSummary,
  listCourierApplicationsAdmin,
  readSmsChallenge,
  writeSmsChallenge,
  deleteSmsChallenge,
  deleteCustomerAccount,
  touchSmsAttempt,
  nextOrderNumber,
  createOrderWithItems,
  listOrdersLegacySorted,
  listOrdersForFeed,
  findOrderWithItems,
  patchOrderScalars,
  findOrderForPayme,
  paymeMarkOrderPaid,
  paymeMarkOrderPaymentPending,
  replaceOrderLines,
  listBannersOrdered,
  bannerToApi,
  createBannerApiShape,
  reorderBanners,
  updateBanner,
  deleteBanner,
  listPromotionsApi,
  createPromotionApi,
  updatePromotion,
  deletePromotion,
  listShortsApi,
  createShortApi,
  reorderShorts,
  updateShortApi,
  deleteShort,
  recordShortViewEvent,
  listShortViewLogs,
  listCustomersAdmin,
  listNotificationsApi,
  createNotificationApi,
  deleteNotification,
  appendShortsNotification,
  bumpShortsBroadcastRepo,
  listAmbientTracks,
  upsertAmbientTrack,
  deleteAmbientSlot,
  storeSummary,
  listUsersForBiometricAdmin
};
