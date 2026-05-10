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
    trackingUpdatedAt: order.trackingUpdatedAt ? order.trackingUpdatedAt.toISOString() : undefined
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

async function listProductsPublicPage({ page, limit, includeTotal = false }) {
  const pg = Math.max(1, Number(page) || 1);
  const lim = Math.max(1, Math.min(100, Number(limit) || 40));
  const skip = (pg - 1) * lim;
  const where = { active: true };
  const rows = await prisma.product.findMany({
    where,
    select: PRODUCT_PUBLIC_SELECT,
    orderBy: { createdAt: 'asc' },
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
  readSmsChallenge,
  writeSmsChallenge,
  deleteSmsChallenge,
  touchSmsAttempt,
  nextOrderNumber,
  createOrderWithItems,
  listOrdersLegacySorted,
  listOrdersForFeed,
  findOrderWithItems,
  patchOrderScalars,
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
