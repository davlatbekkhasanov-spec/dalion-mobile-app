let products = [];
    class CartState {
      constructor() { this.items = new Map(); this.snapshot = []; }
      hydrate(items = []) {
        this.items = new Map();
        this.snapshot = items;
        items.forEach((item) => this.items.set(item.id, Number(item.quantity || 0)));
      }
      qtyOf(id) { return this.items.get(id) || 0; }
      totalQty() { return Array.from(this.items.values()).reduce((a, b) => a + b, 0); }
      clear() { this.items.clear(); this.snapshot = []; }
    }
    const cartState = new CartState();
    let cart = {};
    let currentView = 'homeView';
    let selectedPayment = 'cash';
    const STORE_ADDRESS = 'Samarqand, Shohruh Mirzo 33';
    const STORE_LAT = 39.654572;
    const STORE_LNG = 66.958871;
    const DEFAULT_LOCATION_CITY = 'Samarqand';
    const DEFAULT_LOCATION_ADDRESS = STORE_ADDRESS;
    let currentUser = null;
    let customerLocation = { lat: null, lng: null, accuracy: null, addressText: '', landmarkText: '', permissionDenied: false };
    let activeModalProductId = null;
    let selectedCategory = null;
    let selectedCategoryLabel = '';
    let catalogMode = 'categories';
    let productsPage = 1;
    const productsLimit = 40;
    let productsHasMore = false;
    let productsLoading = false;
    let previousBadgeQty = 0;
    let cartItemsSnapshot = [];
    let homePayload = null;
    let latestOrderNumber = '';
    let activeOrderNumber = localStorage.getItem('activeOrderNumber') || '';
    let ordersHistory = JSON.parse(localStorage.getItem('orders_history') || '[]');
    let mergedCustomerOrders = [];
    const appNavStack = ['homeView'];
    let orderStatusTimer = null;
    let lastOrderData = null;

    const phone = document.getElementById('phone');
    const viewTitles = {
      searchView: 'Katalog',
      cartView: 'Savat',
      checkoutView: 'Checkout'
    };
    const openRegisterBtn = document.getElementById('openRegisterBtn');
    const authSheetOverlay = document.getElementById('authSheetOverlay');
    const closeAuthSheetBtn = document.getElementById('closeAuthSheetBtn');
    const authName = document.getElementById('authName');
    const authPhone = document.getElementById('authPhone');
    const requestOtpBtn = document.getElementById('requestOtpBtn');
    const otpCodeInput = document.getElementById('otpCodeInput');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const devOtpHint = document.getElementById('devOtpHint');
    const submitAuthBtn = document.getElementById('submitAuthBtn');
    const toast = document.getElementById('toast');
    const homeProducts = document.getElementById('homeProducts');
    const homeDiscountProducts = document.getElementById('homeDiscountProducts');
    const homeFastProducts = document.getElementById('homeFastProducts');
    const homeBestSellerProducts = document.getElementById('homeBestSellerProducts');
    const homeReorderProducts = document.getElementById('homeReorderProducts');
    const searchResults = document.getElementById('searchResults');
    const searchInput = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');
    const searchEmpty = document.getElementById('searchEmpty');
    const categoryResults = document.getElementById('categoryResults');
    const categoryBackBtn = document.getElementById('categoryBackBtn');
    const cartItems = document.getElementById('cartItems');
    const cartEmpty = document.getElementById('cartEmpty');
    const cartSummary = document.getElementById('cartSummary');
    const cartTotalPrice = document.getElementById('cartTotalPrice');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartDelivery = document.getElementById('cartDelivery');
    const cartEmptyCta = document.getElementById('cartEmptyCta');
    const cartBadge = document.getElementById('cartBadge');
    const cartUpsellWrap = document.getElementById('cartUpsellWrap');
    const cartUpsellGrid = document.getElementById('cartUpsellGrid');
    const bottomNav = document.getElementById('bottomNav');
    const checkoutItems = document.getElementById('checkoutItems');
    const checkoutTotal = document.getElementById('checkoutTotal');
    const catalogProductResultsTitle = document.getElementById('catalogProductResultsTitle');
    const homeCategories = document.getElementById('homeCategories');
    const homeBrandName = document.getElementById('homeBrandName');
    const homeLocation = document.getElementById('homeLocation');
    const openSearchBtn = document.getElementById('openSearchBtn');
    const homeCartShortcut = document.getElementById('homeCartShortcut');
    const homeCartShortcutBadge = document.getElementById('homeCartShortcutBadge');
    const bannerCarousel = document.getElementById('bannerCarousel');
    const promoCarousel = document.getElementById('promoCarousel');
    const activeOrderCardWrap = document.getElementById('activeOrderCardWrap');
    const checkoutLocation = document.getElementById('checkoutLocation');
    const checkoutAddressLabel = document.getElementById('checkoutAddressLabel');
    const checkoutSavedAddress = document.getElementById('checkoutSavedAddress');
    const checkoutGeo = document.getElementById('checkoutGeo');
    const checkoutLandmark = document.getElementById('checkoutLandmark');
    const checkoutDistance = document.getElementById('checkoutDistance');
    const manualAddress = document.getElementById('manualAddress');
    const landmarkInput = document.getElementById('landmarkInput');
    const paymentLinks = document.getElementById('paymentLinks');
    const paymentProofInput = document.getElementById('paymentProofInput');
    const cashAgreementDetails = document.getElementById('cashAgreementDetails');
    const cashAgreementCheckbox = document.getElementById('cashAgreementCheckbox');
    const cashAgreementLabel = document.getElementById('cashAgreementLabel');
    const checkoutTime = document.getElementById('checkoutTime');
    const checkoutPrice = document.getElementById('checkoutPrice');
    const checkoutSubtotal = document.getElementById('checkoutSubtotal');
    const checkoutDeliveryPrice = document.getElementById('checkoutDeliveryPrice');
    const checkoutGrandTotal = document.getElementById('checkoutGrandTotal');
    const promoCodeInput = document.getElementById('promoCodeInput');
    const checkoutDiscountRow = document.getElementById('checkoutDiscountRow');
    const checkoutDiscount = document.getElementById('checkoutDiscount');
    let promoDiscountPreview = 0;
    const addressValidationError = document.getElementById('addressValidationError');
    const paymentValidationError = document.getElementById('paymentValidationError');
    const successOrderNumber = document.getElementById('successOrderNumber');
    const successOrderTime = document.getElementById('successOrderTime');
    const successOrderStatus = document.getElementById('successOrderStatus');
    const successPaymentMethod = document.getElementById('successPaymentMethod');
    const successAddress = document.getElementById('successAddress');
    const successTotal = document.getElementById('successTotal');
    const trackOrderBtn = document.getElementById('trackOrderBtn');
    const profileName = document.getElementById('profileName');
    const profilePhone = document.getElementById('profilePhone');
    const profileOrders = document.getElementById('profileOrders');
    const profileUserCard = document.getElementById('profileUserCard');
    const profileOrdersCard = document.getElementById('profileOrdersCard');
    const profileGuestCard = document.getElementById('profileGuestCard');
    const profileMenuCard = document.getElementById('profileMenuCard');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileRegisterBtn = document.getElementById('profileRegisterBtn');
    const discountSectionHead = document.getElementById('discountSectionHead');
    const fastSectionHead = document.getElementById('fastSectionHead');
    const bestSectionHead = document.getElementById('bestSectionHead');
    const reorderSectionHead = document.getElementById('reorderSectionHead');

    const CURATED_CATEGORIES = [
      { key: 'Kanselyariya', displayName: 'Kanselyariya', icon: '✏️', match: ['kanselyariya'] },
      { key: 'Ofis jihozlari', displayName: 'Ofis jihozlari', icon: '🪑', match: ['ofis jihozlari'] },
      { key: 'Kompyuter aksessuarlari', displayName: 'Kompyuter aksessuarlari', icon: '🖱️', match: ['kompyuter aksessuarlari'] },
      { key: 'USB va kabellar', displayName: 'USB va kabellar', icon: '🔌', match: ['usb va kabellar'] },
      { key: 'Ichimliklar', displayName: 'Ichimliklar', icon: '🥤', match: ['ichimliklar'] }
    ];

    const modalOverlay = document.getElementById('productModalOverlay');
    const modalUpsellTitle = document.getElementById('modalUpsellTitle');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalName = document.getElementById('modalName');
    const modalCategory = document.getElementById('modalCategory');
    const modalPrice = document.getElementById('modalPrice');
    const modalOldPrice = document.getElementById('modalOldPrice');
    const modalStickyPrice = document.getElementById('modalStickyPrice');
    const modalRating = document.getElementById('modalRating');
    const modalEta = document.getElementById('modalEta');
    const modalAvailability = document.getElementById('modalAvailability');
    const modalDescription = document.getElementById('modalDescription');
    const modalSpecs = document.getElementById('modalSpecs');
    const modalRecommendations = document.getElementById('modalRecommendations');
    const modalTrustDelivery = document.getElementById('modalTrustDelivery');
    const modalQty = document.getElementById('modalQty');
    const modalAddBtn = document.getElementById('modalAddBtn');
    const modalImageBox = document.querySelector('.modal-image');
    const locationDeniedOverlay = document.getElementById('locationDeniedOverlay');
    const profileActionOverlay = document.getElementById('profileActionOverlay');
    const profileActionTitle = document.getElementById('profileActionTitle');
    const profileActionBody = document.getElementById('profileActionBody');
    const closeProfileActionBtn = document.getElementById('closeProfileActionBtn');
    const profileAddress = document.getElementById('profileAddress');
    const COURIER_TELEGRAM_LINK = 'https://t.me/globusmarket_couriers';
    let authOtpState = 'idle';
    let otpResendAt = 0;
    const retryLocationBtn = document.getElementById('retryLocationBtn');
    const manualLocationBtn = document.getElementById('manualLocationBtn');

    function money(v) {
      return `${Number(v || 0).toLocaleString('ru-RU')} so'm`;
    }

    async function api(path, options = {}) {
      const headers = { ...(options.headers || {}) };
      const hasBody = options.body !== undefined && options.body !== null;
      const isFormData = typeof FormData !== 'undefined' && hasBody && options.body instanceof FormData;
      if (!isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
      if (currentUser?.phone) headers['x-user-phone'] = currentUser.phone;
      const authToken = localStorage.getItem('authToken') || '';
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const wsToken = localStorage.getItem('wholesaleToken') || '';
      if (wsToken) headers['x-wholesale-token'] = wsToken;
      const res = await fetch(`/api/v1${path}`, {
        headers,
        ...options
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Server xatosi');
      }
      return data;
    }

    async function loadProducts({ reset = false } = {}) {
      if (productsLoading) return;
      productsLoading = true;
      try {
        if (reset) productsPage = 1;
        const collected = [];
        let page = productsPage;
        while (true) {
          const params = new URLSearchParams({ page: String(page), limit: String(productsLimit) });
          const data = await api(`/products?${params.toString()}`);
          const incoming = (data.items || data.products || []).filter((p) => p.active !== false);
          collected.push(...incoming);
          if (!data.hasMore) break;
          page += 1;
        }
        const merged = reset ? collected : products.concat(collected);
        products = Array.from(new Map(merged.map((item) => [item.id, item])).values());
        productsHasMore = false;
      } finally {
        productsLoading = false;
      }
    }

    async function loadHomePayload() {
      homePayload = await api('/home');
      const settings = homePayload?.home_settings || {};
      const banners = homePayload?.banners || [];
      const promotions = homePayload?.promotions || [];
      const delivery = homePayload?.delivery_info || {};

      homeBrandName.textContent = 'GlobusMarket';
      homeLocation.textContent = `📍 ${DEFAULT_LOCATION_ADDRESS}`;
      openSearchBtn.textContent = 'Mahsulot qidirish...';

      const fallbackBanner = {
        title: 'Tez yetkazib berish',
        subtitle: 'Buyurtmangiz tez va qulay yetkaziladi',
        badge: '20–30 daqiqa',
        image_url: ''
      };
      const bannerItems = banners.length ? banners : [fallbackBanner];
      bannerCarousel.innerHTML = bannerItems.map((b) => `
        <article class="promo gm-card">
          <div>
            <h3>${fallbackBanner.title}</h3>
            <p>${fallbackBanner.subtitle}</p>
            <span class="gm-chip gm-chip--delivery">${fallbackBanner.badge}</span>
          </div>
          <div class="truck">${b.image_url ? `<img src="${b.image_url}" alt="Yetkazib berish" style="width:100%;height:100%;object-fit:cover;border-radius:16px;" />` : '📦'}</div>
        </article>
      `).join('');

      const fallbackPromo = {
        title: settings.bonusTitle || 'Siz uchun qulay tanlov',
        description: settings.bonusSubtitle || 'Har kuni yangi va sifatli mahsulotlar',
        image_url: ''
      };
      const promoItems = promotions.length ? promotions : [fallbackPromo];
      promoCarousel.innerHTML = promoItems.map((p) => `
        <article class="bonus gm-card">
          <div>
            <h5>${p.title || fallbackPromo.title}</h5>
            <p>${p.description || p.discount_text || fallbackPromo.description}</p>
          </div>
          <div class="coin">${p.image_url ? `<img src="${p.image_url}" alt="${p.title || 'promo'}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : '★'}</div>
        </article>
      `).join('');

      const bg = String(settings.backgroundImageUrl || '').trim();
      const accent = String(settings.accentColor || '').trim();
      if (bg) {
        document.getElementById('homeView').style.backgroundImage = `linear-gradient(180deg, rgba(9, 19, 36, 0.85), rgba(6, 14, 28, 0.92)), url('${bg}')`;
        document.getElementById('homeView').style.backgroundSize = 'cover';
      } else {
        document.getElementById('homeView').style.backgroundImage = '';
      }
      if (accent) {
        document.querySelectorAll('.full-btn, .qty button, .pay-btn.active').forEach((el) => {
          el.style.borderColor = accent;
        });
      }
      checkoutLocation.textContent = `Manzil: ${delivery.location || DEFAULT_LOCATION_ADDRESS}`;
      checkoutTime.textContent = `Vaqt: ${settings.deliveryTimeText || delivery.time || '30 daqiqa'}`;
      checkoutPrice.textContent = `Narx: ${money(Number(getDeliveryState().deliveryPrice || 0))}`;
    }

    async function loadCart() {
      if (!currentUser?.phone) {
        cart = {};
        cartItemsSnapshot = [];
        cartState.clear();
        return { items: [], totalQty: 0, subtotal: 0 };
      }
      const summary = await api('/cart');
      const uniqueItems = Array.from(new Map((summary.items || []).map((item) => [item.id, item])).values());
      cartItemsSnapshot = uniqueItems;
      cartState.hydrate(uniqueItems);
      cart = Object.fromEntries(cartState.items);
      return { ...summary, items: uniqueItems };
    }

    async function loadProfile() {
      const local = JSON.parse(localStorage.getItem('globusUser') || 'null');
      if (local && local.name && local.phone) {
        local.address = String(local.address || '').trim() || DEFAULT_LOCATION_ADDRESS;
        currentUser = local;
        localStorage.setItem('globusUser', JSON.stringify(currentUser));
        return;
      }
      currentUser = null;
    }

    function isAuthed() {
      return !!(currentUser && currentUser.name && currentUser.phone);
    }

    function resolvePreferredAddress() {
      return String(manualAddress.value || customerLocation.addressText || currentUser?.address || '').trim();
    }

    function haversineKm(lat1, lng1, lat2, lng2) {
      const toRad = (deg) => (Number(deg) * Math.PI) / 180;
      const earthKm = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return 2 * earthKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function calculateDeliveryPrice(distanceKm) {
      if (!Number.isFinite(distanceKm)) return null;
      const raw = distanceKm <= 4 ? 18500 : (18500 + ((distanceKm - 4) * 4000));
      return Math.round(raw / 500) * 500;
    }

    function getDeliveryState() {
      const hasGeo = Number.isFinite(Number(customerLocation.lat)) && Number.isFinite(Number(customerLocation.lng))
        && !(Number(customerLocation.lat) === 0 && Number(customerLocation.lng) === 0);
      const distanceKm = hasGeo ? haversineKm(STORE_LAT, STORE_LNG, Number(customerLocation.lat), Number(customerLocation.lng)) : null;
      const deliveryPrice = calculateDeliveryPrice(distanceKm);
      return { hasGeo, distanceKm, deliveryPrice };
    }

    async function reverseGeocode(lat, lng) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`);
        if (!res.ok) return '';
        const data = await res.json();
        return String(data?.display_name || '').trim();
      } catch (_) {
        return '';
      }
    }

    async function submitAuth() {
      const phoneValue = String(authPhone.value || '').trim();
      const nameValue = String(authName.value || '').trim();
      const finalName = nameValue || 'Foydalanuvchi';
      if (!phoneValue) { showToast('Telefon raqam kiriting'); return false; }
      currentUser = { name: finalName, phone: phoneValue, createdAt: new Date().toISOString() };
      localStorage.setItem('globusUser', JSON.stringify(currentUser));
      await api('/profile', { method: 'PUT', body: JSON.stringify({ name: currentUser.name, phone: currentUser.phone, address: '' }) });
      authSheetOverlay.classList.remove('show');
      showToast("Ro'yxatdan o'tildi");
      return true;
    }

    async function requestOtpCode() {
      const phoneValue = String(authPhone.value || '').trim();
      if (!phoneValue) { showToast('Telefon raqam kiriting'); return; }
      if (!/^\+998\d{9}$/.test(String(phoneValue).replace(/\s+/g, ''))) { showToast('+998 XX XXX XX XX formatida kiriting'); return; }
      if (Date.now() < otpResendAt) { showToast('Kodni qayta yuborish uchun kuting'); return; }
      authOtpState = 'otp_sent';
      await api('/auth/request-otp', { method: 'POST', body: JSON.stringify({ phone: phoneValue }) });
      otpResendAt = Date.now() + 60000;
      devOtpHint.style.display = 'block';
      devOtpHint.textContent = 'Kod yuborildi. 60 soniyadan keyin qayta yuborish mumkin.';
      const timer = setInterval(() => {
        const left = Math.max(0, Math.ceil((otpResendAt - Date.now()) / 1000));
        requestOtpBtn.textContent = left > 0 ? `Kodni qayta olish (${left}s)` : 'Kod olish';
        if (left <= 0) clearInterval(timer);
      }, 500);
      showToast('OTP yuborildi');
    }

    async function verifyOtpCode() {
      const phoneValue = String(authPhone.value || '').trim();
      const codeValue = String(otpCodeInput.value || '').trim();
      if (!phoneValue || !codeValue) { showToast('Telefon va OTP kodni kiriting'); return; }
      authOtpState = 'verifying';
      const out = await api('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone: phoneValue, code: codeValue }) });
      const verifiedUser = out.user || { phone: phoneValue, name: currentUser?.name || 'Foydalanuvchi', role: 'user' };
      currentUser = { ...currentUser, ...verifiedUser };
      localStorage.setItem('globusUser', JSON.stringify(currentUser));
      authOtpState = 'verified';
      if (out.token) localStorage.setItem('authToken', out.token);
      showToast('Kod tasdiqlandi');
    }

    
    function openProfileAction(title, bodyHtml) {
      profileActionTitle.textContent = title;
      profileActionBody.innerHTML = bodyHtml;
      profileActionOverlay.classList.add('show');
    }

    function closeProfileAction() {
      profileActionOverlay.classList.remove('show');
    }

    function requireAuthOrIntro() {
      if (isAuthed()) return true;
      showToast("Avval ro‘yxatdan o‘ting");
      phone.classList.remove('show-app');
      authSheetOverlay.classList.add('show');
      return false;
    }

    function qtyOf(id) {
      return cartState.qtyOf(id);
    }

    function showToast(text) {
      toast.textContent = text;
      toast.classList.add('show');
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => toast.classList.remove('show'), 1300);
    }

    function orderStatusLabel(status) {
      return {
        new: 'Yangi buyurtma',
        sent_to_tsd: 'Tovar terilmoqda',
        picking: 'Tovar terilmoqda',
        picked: 'Yig‘ildi / kurier kutilmoqda',
        waiting_courier: 'Yig‘ildi / kurier kutilmoqda',
        out_for_delivery: 'Kurierda',
        delivered: 'Yetkazildi',
        cancelled: 'Bekor qilingan',
        created: 'Yaratildi',
        pending_payment: 'To‘lov kutilmoqda',
        paid: 'To‘landi'
      }[status] || status || '-';
    }

    
    function paymentMethodLabel(method) {
      return {
        cash: 'Naqd',
        payme: 'Payme',
        click: 'Click'
      }[String(method || '').toLowerCase()] || '-';
    }

    function paymentStatusLabel(status) {
      return {
        payment_pending: 'To‘lov kutilmoqda',
        pending: 'To‘lov kutilmoqda',
        paid: 'To‘lov qilingan',
        unpaid: 'To‘lov qilinmagan',
        cancelled: 'Bekor qilingan'
      }[String(status || '').toLowerCase()] || '-';
    }

    function isActiveOrderStatus(status) {
      return ['new', 'sent_to_tsd', 'picking', 'picked', 'waiting_courier', 'out_for_delivery'].includes(String(status || ''));
    }

    function totalQty() {
      return cartState.totalQty();
    }

    function totalPrice() {
      return cartItemsSnapshot.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    }

    function getCheckoutTotalsSnapshot() {
      const deliveryPrice = Number(getDeliveryState().deliveryPrice || 0);
      const productsSubtotal = totalPrice();
      const discountAmount = cartItemsSnapshot.reduce((sum, item) => {
        const qty = Number(item.quantity || cart[item.id] || 0);
        const oldPrice = Number(item.old_price || item.oldPrice || 0);
        const currentPrice = Number(item.price || 0);
        if (!qty || !(oldPrice > currentPrice)) return sum;
        return sum + ((oldPrice - currentPrice) * qty);
      }, 0);
      const finalTotal = productsSubtotal + deliveryPrice;
      return {
        productsSubtotal,
        deliveryPrice,
        discountAmount,
        finalTotal
      };
    }

    async function setQty(id, value, showAddToast = false) {
      const p = products.find((x) => x.id === id);
      const stockLimit = Number(p?.stock ?? 0);
      if (stockLimit <= 0 && Number(value) > 0) {
        showToast("Omborda yo'q");
        return;
      }
      const quantity = Math.max(0, Math.min(Number(value) || 0, stockLimit));
      await api('/cart/items', {
        method: 'PUT',
        body: JSON.stringify({ productId: id, quantity })
      });
      await loadCart();
      if (showAddToast) showToast("Savatga qo'shildi");
      renderAll();
    }

    function makeQtyControls(id) {
      const p = products.find((x) => x.id === id);
      const stock = Number(p?.stock ?? 0);
      const q = qtyOf(id);
      const plusDisabled = stock <= 0 || q >= stock ? 'disabled' : '';
      return `
        <button class="qty-minus" data-action="qty-minus" data-id="${id}">−</button>
        <span>${q}</span>
        <button class="qty-plus" data-action="qty-plus" data-id="${id}" ${plusDisabled}>+</button>
      `;
    }

    function productCardTemplate(p) {
      const stock = Number(p.stock ?? 0);
      const oldPrice = Number(p.oldPrice || p.old_price || 0);
      const price = Number(p.price || 0);
      const hasDiscount = oldPrice > price && price > 0;
      const discountPercent = hasDiscount ? Math.max(1, Math.round(((oldPrice - price) / oldPrice) * 100)) : 0;
      const ratingValue = Number(p.rating || 4.8);
      const reviews = Number(p.reviewCount || 120);
      const priceText = price > 0 ? money(price) : 'Narx aniqlanmoqda';
      const imageHtml = p.image_url
        ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" decoding="async" />`
        : imageFallbackTemplate(p.name);
      return `
        <article class="product" data-action="open-product" data-product-id="${p.id}">
          <div class="image-box">
            <div class="product-top-row">
              ${hasDiscount ? `<span class="gm-chip discount-chip product-discount">-${discountPercent}%</span>` : '<span></span>'}
              <button class="fav-btn" type="button" data-action="favorite" aria-label="Saralanganlarga qo‘shish">❤</button>
            </div>
            ${imageHtml}
          </div>
          <div class="product-info">
            <p class="price">${priceText}</p>
            <p class="old-price">${hasDiscount ? money(oldPrice) : ''}</p>
            <h5>${p.name}</h5>
            <p class="product-rating">⭐ ${ratingValue.toFixed(1)} (${reviews})</p>
            ${qtyOf(p.id) > 0
              ? `<div class="qty" data-qty-wrap="${p.id}">${makeQtyControls(p.id)}</div>`
              : `<button class="btn gm-btn gm-btn-primary quick-add-btn" data-action="add-to-cart" data-id="${p.id}" ${stock <= 0 ? 'disabled' : ''}>Savatga qo‘shish</button>`}
          </div>
        </article>
      `;
    }

    function imageFallbackTemplate(categoryName = '') {
      return `<div class="image-fallback"><i>🖼️</i><span>Rasm yo‘q</span></div>`;
    }

    function setSectionVisibility(sectionEl, headEl, hasItems) {
      sectionEl.style.display = hasItems ? 'grid' : 'none';
      if (headEl) headEl.style.display = hasItems ? 'flex' : 'none';
    }

    function dedupeProductsById(items = []) {
      return Array.from(new Map(items.map((item) => [item.id, item])).values());
    }

    function renderHome() {
      const popular = products
        .slice()
        .sort((a, b) => {
          const byOrders = Number(b.orderCount || 0) - Number(a.orderCount || 0);
          if (byOrders !== 0) return byOrders;
          const byStock = Number(b.stock || 0) - Number(a.stock || 0);
          if (byStock !== 0) return byStock;
          const byPrice = Number(b.price || 0) - Number(a.price || 0);
          if (byPrice !== 0) return byPrice;
          return String(a.name || '').localeCompare(String(b.name || ''), 'uz');
        })
        .slice(0, 12);
      const discounts = dedupeProductsById(products.filter((p) => Number(p.oldPrice || 0) > Number(p.price || 0)).slice(0, 6));
      const fast = dedupeProductsById(products.filter((p) => Number(p.stock || 0) > 0).slice(0, 6));
      const bestSeller = popular.slice(0, 6);
      const reorder = cartItemsSnapshot.length
        ? products.filter((p) => cartItemsSnapshot.some((c) => c.id === p.id)).slice(0, 6)
        : [];

      homeProducts.innerHTML = popular.map(productCardTemplate).join('') || '<div class="empty gm-empty-state"><strong>Mahsulotlar hali yuklanmagan</strong><br/>Admin panel orqali Excel import qiling yoki DALION sinxronizatsiyasini ulang</div>';
      homeDiscountProducts.innerHTML = discounts.map(productCardTemplate).join('');
      homeFastProducts.innerHTML = fast.map(productCardTemplate).join('');
      homeBestSellerProducts.innerHTML = bestSeller.map(productCardTemplate).join('');
      homeReorderProducts.innerHTML = reorder.map(productCardTemplate).join('');
      setSectionVisibility(homeDiscountProducts, discountSectionHead, discounts.length > 0);
      setSectionVisibility(homeFastProducts, fastSectionHead, fast.length > 0);
      setSectionVisibility(homeBestSellerProducts, bestSectionHead, bestSeller.length > 0);
      setSectionVisibility(homeReorderProducts, reorderSectionHead, reorder.length > 0);
    }

    function normalizedCategoryName(categoryName) {
      return String(categoryName || '').trim() || 'Boshqa';
    }
    function normalizeCategoryKey(rawCategory, productName = '') {
      const text = `${normalizedCategoryName(rawCategory)} ${productName}`.toLowerCase();
      const byRule = CURATED_CATEGORIES.find((c) => c.key !== 'Boshqa' && c.match.some((m) => text.includes(m.toLowerCase())));
      return byRule ? byRule.key : 'Boshqa';
    }

    function getCategoryIcon(name) {
      const n = String(name || '').toLowerCase();
      if (n.includes('ichim')) return '🥤';
      if (n.includes('shirin')) return '🍬';
      if (n.includes('sut')) return '🥛';
      if (n.includes("go'sht") || n.includes('gosht')) return '🥩';
      if (n.includes('meva')) return '🍏';
      if (n.includes('блокнот') || n.includes('daftar') || n.includes('тетрад')) return '📒';
      if (n.includes('альбом') || n.includes('rasm') || n.includes('рисов')) return '🎨';
      if (n.includes('азбук') || n.includes('kitob') || n.includes('книга')) return '📚';
      if (n.includes('kantsely') || n.includes('канц') || n.includes('karandash') || n.includes('ручка')) return '✏️';
      if (n.includes('доск')) return '🧱';
      if (n.includes('игр')) return '🎲';
      if (n.includes('калькулятор')) return '🧮';
      if (n.includes('gigien')) return '🧴';
      return '📦';
    }

    function getCategoryEntries() {
      const counts = new Map();
      products.forEach((p) => {
        const key = normalizedCategoryName(p.categoryDisplayName || p.category);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      const dynamic = Array.from(counts.entries())
        .map(([key, count]) => ({ key, displayName: key, icon: getCategoryIcon(key), count }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'uz'));
      return [{ key: 'all', displayName: 'Hammasi', icon: '🛍️', count: products.length }, ...dynamic];
    }

    function productMatchesCategory(product, categoryKey) {
      if (!categoryKey || categoryKey === 'all') return true;
      return normalizedCategoryName(product.categoryDisplayName || product.category) === categoryKey;
    }
    function renderHomeCategories() {
      const entries = getCategoryEntries().filter((c) => c.key === 'all' || c.count > 0);
      homeCategories.innerHTML = entries.map((c) => `
        <article class="cat gm-card ${selectedCategory===c.key?'active':''}" data-home-category="${c.key}" data-home-category-label="${c.displayName}">
          <i>${c.image_url ? `<img src="${c.image_url}" alt="${c.displayName}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" />` : c.icon}</i>
          <span class="cat-label gm-chip">${c.displayName}</span>
        </article>
      `).join('');
    }

    function renderSearch() {
      const query = searchInput.value.trim().toLowerCase();
      searchClearBtn.classList.toggle('show', Boolean(query));
      if (catalogMode === 'categories') {
        const categories = getCategoryEntries()
          .filter((c) => c.key === 'all' || c.count > 0)
          .filter((c) => c.displayName.toLowerCase().includes(query));
        categoryResults.innerHTML = categories.map((c) => `
          <article class="category-card gm-card ${selectedCategory===c.key?'active':''}" data-category="${c.key}" data-category-label="${c.displayName}">
            <span class="icon">${c.image_url ? `<img src="${c.image_url}" alt="${c.displayName}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" />` : c.icon}</span>
            <div><b>${c.displayName}</b><small>${c.count} ta mahsulot</small></div>
            <span>›</span>
          </article>
        `).join('');
        categoryResults.style.display = 'grid';
        categoryBackBtn.style.display = 'none';
        const byProduct = products.filter((p) => p.name.toLowerCase().includes(query));
        catalogProductResultsTitle.style.display = query ? 'block' : 'none';
        catalogProductResultsTitle.textContent = query ? "Mahsulotlar bo'yicha natijalar" : '';
        searchResults.innerHTML = query ? byProduct.slice(0, 12).map(productCardTemplate).join('') : '';
        searchEmpty.style.display = (!categories.length && !byProduct.length) ? 'block' : 'none';
        return;
      }

      const byCategory = products.filter((p) => productMatchesCategory(p, selectedCategory));
      const filteredProducts = byCategory.filter((p) => p.name.toLowerCase().includes(query));
      categoryResults.style.display = 'none';
      categoryResults.innerHTML = '';
      categoryBackBtn.style.display = 'inline-flex';
      catalogProductResultsTitle.style.display = 'block';
      catalogProductResultsTitle.textContent = selectedCategoryLabel || selectedCategory || 'Katalog';
      searchResults.innerHTML = filteredProducts.map(productCardTemplate).join('');
      searchEmpty.style.display = filteredProducts.length ? 'none' : 'block';
    }

    function renderCart() {
      if (!cartItemsSnapshot.length) {
        cartItems.innerHTML = '';
        cartEmpty.style.display = 'block';
        cartSummary.style.display = 'none';
        cartUpsellWrap.style.display = 'none';
        cartUpsellGrid.innerHTML = '';
        return;
      }

      cartEmpty.style.display = 'none';
      cartSummary.style.display = 'block';
      cartItems.innerHTML = cartItemsSnapshot.map((item) => {
        const imageHtml = item.image_url ? `<img class="cart-item-thumb" src="${item.image_url}" alt="${item.name}" loading="lazy" decoding="async" />` : '';
        const stockInfo = Number(item.stock ?? item.available_stock ?? item.availableQuantity);
        const hasWarn = Number.isFinite(stockInfo) && stockInfo <= 0;
        return `
          <article class="list-card gm-card cart-item-card">
            <div class="cart-item-top">
              ${imageHtml}
              <div style="flex:1;">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-meta">
                  <strong>${money(item.price)}</strong>
                  <button class="icon-btn cart-remove-btn" data-action="remove-from-cart" data-id="${item.id}">Olib tashlash</button>
                </div>
              </div>
            </div>
            <div class="cart-item-actions">
              <div class="qty" data-qty-wrap="${item.id}" style="width:116px; margin:0;">${makeQtyControls(item.id)}</div>
              <strong>${money(item.subtotal)}</strong>
            </div>
            ${hasWarn ? '<p class="cart-item-warn">Ushbu mahsulot hozircha mavjud emas.</p>' : ''}
          </article>
        `;
      }).join('');

      const subtotal = totalPrice();
      const deliveryPrice = Number(getDeliveryState().deliveryPrice || 0);
      cartSubtotal.textContent = money(subtotal);
      cartDelivery.textContent = money(deliveryPrice);
      cartTotalPrice.textContent = money(subtotal + deliveryPrice);

      const cartUpsell = getCartUpsellProducts();
      if (cartUpsell.length) {
        cartUpsellWrap.style.display = 'block';
        cartUpsellGrid.innerHTML = cartUpsell.map(upsellCardTemplate).join('');
      } else {
        cartUpsellWrap.style.display = 'none';
        cartUpsellGrid.innerHTML = '';
      }
    }

    function renderCheckout() {
      const selected = products.filter((p) => qtyOf(p.id) > 0);
      document.getElementById('checkoutUserName').textContent = currentUser?.name || "Foydalanuvchi";
      document.getElementById('checkoutUserPhone').textContent = currentUser?.phone ? `Telefon: ${currentUser.phone}` : "Telefon mavjud emas";
      checkoutItems.innerHTML = selected.map((p) => {
        const qty = qtyOf(p.id);
        const imageHtml = p.image_url ? `<img class="cart-item-thumb" src="${p.image_url}" alt="${p.name}" loading="lazy" decoding="async" />` : '';
        return `
          <article class="list-card gm-card cart-item-card">
            <div class="cart-item-top">
              ${imageHtml}
              <div style="flex:1;">
                <div class="cart-item-title">${p.name}</div>
                <div class="cart-item-meta"><span>${qty} dona</span><strong>${money(p.price * qty)}</strong></div>
              </div>
            </div>
          </article>
        `;
      }).join('');

      const deliveryState = getDeliveryState();
      const deliveryPrice = Number(deliveryState.deliveryPrice || 0);
      const subtotal = totalPrice();
      const orderTotal = subtotal + deliveryPrice;
      checkoutTotal.textContent = `Jami: ${money(Math.max(0, orderTotal - Number(promoDiscountPreview || 0)))}`;
      checkoutSubtotal.textContent = money(subtotal);
      checkoutDeliveryPrice.textContent = money(deliveryPrice);
      const finalTotal = Math.max(0, orderTotal - Number(promoDiscountPreview || 0));
      checkoutGrandTotal.textContent = money(finalTotal);
      const preferredAddress = resolvePreferredAddress();
      checkoutSavedAddress.textContent = `Saqlangan manzil: ${currentUser?.address || 'Manzil qo‘shilmagan'}`;
      checkoutLocation.textContent = `Do'kon: ${STORE_ADDRESS}`;
      checkoutAddressLabel.textContent = `Mijoz manzili: ${preferredAddress || 'Manzil kiritilmagan'}`;
      checkoutLandmark.textContent = `Orientir: ${customerLocation.landmarkText || landmarkInput.value || '-'}`;
      checkoutGeo.textContent = deliveryState.hasGeo
        ? `Geo: ${Number(customerLocation.lat).toFixed(6)}, ${Number(customerLocation.lng).toFixed(6)} (±${Math.round(Number(customerLocation.accuracy || 0))}m)`
        : 'Geo: olinmagan';
      checkoutDistance.textContent = Number.isFinite(deliveryState.distanceKm) ? `Masofa: ${deliveryState.distanceKm.toFixed(1)} km` : 'Masofa: Aniqlanmagan';
      checkoutTime.textContent = "4 km gacha 18 500 so‘m, keyin har km uchun 4 000 so‘m";
      checkoutPrice.textContent = `Narx: ${money(deliveryPrice)}`;
      const checkoutLocationHint = document.getElementById('checkoutLocationHint');
      if (checkoutLocationHint) {
        checkoutLocationHint.textContent = customerLocation.permissionDenied
          ? 'Masofa aniqlanmagan. GPS ni yoqing yoki manzil kiriting.'
          : 'Lokatsiya olindi.';
      }
      const clickAmountTiyin = Math.round(Number(finalTotal || 0) * 100);
      if (selectedPayment === 'click') paymentLinks.innerHTML = `Click: <a href="https://indoor.click.uz/pay?id=081328&t=${clickAmountTiyin}" target="_blank">To‘lov havolasi</a>`;
      else if (selectedPayment === 'payme') paymentLinks.innerHTML = 'Payme: To‘lovni Payme ilovasi orqali yakunlang. To‘lov holati: To‘lov kutilmoqda';
      else paymentLinks.innerHTML = 'To‘lov yetkazib berilganda naqd amalga oshiriladi';
      const isOnline = selectedPayment === 'click' || selectedPayment === 'payme';
      paymentProofInput.style.display = 'none';
      cashAgreementDetails.style.display = selectedPayment === 'cash' ? 'block' : 'none';
      cashAgreementLabel.style.display = selectedPayment === 'cash' ? 'block' : 'none';
      addressValidationError.style.display = 'none';
      paymentValidationError.style.display = 'none';
      checkoutDiscountRow.style.display = promoDiscountPreview > 0 ? 'flex' : 'none';
      checkoutDiscount.textContent = `-${money(promoDiscountPreview)}`;
    }

    
    async function previewPromoDiscount() {
      const code = String(promoCodeInput?.value || '').trim();
      if (!code) { promoDiscountPreview = 0; renderCheckout(); return; }
      try {
        const out = await api('/promos/validate', { method: 'POST', body: JSON.stringify({ code, subtotal: totalPrice() }) });
        promoDiscountPreview = Math.max(0, Number(out.discount || 0));
      } catch {
        promoDiscountPreview = 0;
      }
      renderCheckout();
    }

    async function loadCustomerOrders() {
      if (!currentUser?.phone) return [];
      try {
        const out = await api(`/customer/orders?phone=${encodeURIComponent(currentUser?.phone)}`);
        return out.orders || [];
      } catch {
        return [];
      }
    }

    function pushOrderHistory(order) {
      const id = String(order.orderNumber || '');
      if (!id) return;
      if (!ordersHistory.some((o) => o.orderNumber === id)) {
        ordersHistory.unshift({
          orderNumber: id,
          status: order.status,
          total: order.total,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          feedbackAt: order.feedbackAt || null,
          created_at: order.created_at,
          items: Array.isArray(order.items) ? order.items : [],
          customerAddress: order.customerAddress || order.addressText || order.location || ''
        });
        localStorage.setItem('orders_history', JSON.stringify(ordersHistory.slice(0, 100)));
      }
    }

    function compactOrderItemsPreview(items = []) {
      const names = (items || []).slice(0, 2).map((item) => item?.name).filter(Boolean);
      const extraCount = Math.max(0, Number(items?.length || 0) - names.length);
      const preview = names.join(', ');
      if (!preview && !extraCount) return 'Mahsulotlar ko‘rsatilmagan';
      return extraCount > 0 ? `${preview} +${extraCount} ta` : preview;
    }

    function mergeCustomerOrders(apiOrders = []) {
      const mergedMap = new Map();
      [...apiOrders, ...ordersHistory].forEach((order) => {
        const orderNumber = String(order?.orderNumber || '').trim();
        if (!orderNumber) return;
        const existing = mergedMap.get(orderNumber) || {};
        mergedMap.set(orderNumber, {
          ...existing,
          ...order,
          orderNumber,
          items: Array.isArray(order?.items) && order.items.length ? order.items : (existing.items || [])
        });
      });
      return Array.from(mergedMap.values()).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    async function reorderFromOrder(orderNumber) {
      if (!requireAuthOrIntro()) return;
      const order = mergedCustomerOrders.find((item) => String(item.orderNumber) === String(orderNumber));
      if (!order) {
        showToast("Buyurtma topilmadi");
        return;
      }
      const orderItems = Array.isArray(order.items) ? order.items : [];
      if (!orderItems.length) {
        showToast("Qayta buyurtma uchun mahsulot yo‘q");
        return;
      }

      let addedAny = false;
      let adjustedCount = 0;
      for (const item of orderItems) {
        const product = products.find((p) => p.id === item.id);
        if (!product) { adjustedCount += 1; continue; }
        const stock = Math.max(0, Number(product.stock || 0));
        if (stock <= 0) { adjustedCount += 1; continue; }
        const requestedQty = Math.max(0, Number(item.quantity || 0));
        const finalQty = Math.min(requestedQty, stock);
        if (finalQty <= 0) { adjustedCount += 1; continue; }
        await api('/cart/items', {
          method: 'PUT',
          body: JSON.stringify({ productId: item.id, quantity: finalQty })
        });
        addedAny = true;
        if (finalQty < requestedQty) adjustedCount += 1;
      }

      await loadCart();
      renderAll();
      setView('cartView', { push: true });
      if (!addedAny) {
        showToast("Mahsulotlar hozircha mavjud emas");
        return;
      }
      showToast(adjustedCount > 0 ? "Qisman qayta buyurtma savatga qo‘shildi" : "Buyurtma savatga qayta qo‘shildi");
    }

    async function renderActiveOrderCard() {
      if (!activeOrderNumber) {
        activeOrderCardWrap.innerHTML = '';
        return;
      }
      try {
        const data = await api(`/orders/${encodeURIComponent(activeOrderNumber)}/track`);
        const o = data.order;
        if (!o) { activeOrderCardWrap.innerHTML = ''; return; }
        if (!isActiveOrderStatus(o.status)) {
          pushOrderHistory(o);
          activeOrderNumber = '';
          localStorage.removeItem('activeOrderNumber');
          activeOrderCardWrap.innerHTML = '';
          return;
        }
        activeOrderCardWrap.innerHTML = `<article class="list-card gm-card"><h4 style="margin-bottom:6px;">Faol buyurtma</h4><div class="muted">#${o.orderNumber} · ${orderStatusLabel(o.status)}</div><div class="muted">Jami: ${money(o.total || 0)}</div><div style="display:flex;gap:8px;margin-top:8px;"><a class="btn gm-btn gm-btn-secondary btn-secondary" href="/track/${encodeURIComponent(o.orderNumber)}" target="_blank" style="text-align:center;">Kuzatish</a></div></article>`;
      } catch {
        activeOrderCardWrap.innerHTML = '';
      }
    }

    async function renderProfileOrders() {
      if (!isAuthed()) {
        profileUserCard.style.display = 'none';
        profileOrdersCard.style.display = 'none';
        profileMenuCard.style.display = 'none';
        profileGuestCard.style.display = 'block';
        return;
      }
      profileGuestCard.style.display = 'none';
      profileMenuCard.style.display = 'block';
      profileUserCard.style.display = 'block';
      profileOrdersCard.style.display = 'block';
      const wholesaleMode = Boolean(localStorage.getItem('wholesaleToken'));
      const courierMode = String(currentUser?.role || '') === 'courier';
      profileName.textContent = `${currentUser?.name || 'Foydalanuvchi'}${wholesaleMode ? ' · Оптовый режим' : ''}${courierMode ? ' · Siz kuryer sifatida tasdiqlandingiz' : ''}`;
      profilePhone.textContent = `Telefon: ${currentUser?.phone || '-'}`;
      profileAddress.textContent = `Manzil: ${currentUser?.address || 'Manzil qo‘shilmagan'}`;
      const orders = await loadCustomerOrders();
      mergedCustomerOrders = mergeCustomerOrders(orders);
      if (!mergedCustomerOrders.length) {
        profileOrders.innerHTML = '<div class="empty">Sizda hali buyurtmalar yo‘q</div>';
        return;
      }
      profileOrders.innerHTML = mergedCustomerOrders.map((o) => `
        <article class="list-card gm-card" style="margin-bottom:10px;">
          <div><b>#${o.orderNumber || '-'}</b></div>
          <div class="muted">${new Date(o.created_at || Date.now()).toLocaleString('ru-RU')}</div>
          <div class="muted">Status: ${orderStatusLabel(o.status)}</div>
          <div class="muted">Jami: ${money(o.total || 0)}</div>
          <div class="muted">Mahsulotlar: ${compactOrderItemsPreview(o.items || [])}</div>
          <details style="margin-top:8px;">
            <summary style="cursor:pointer;color:#bfe3ff;">Buyurtma tafsiloti</summary>
            <div style="margin-top:8px;display:grid;gap:6px;">
              ${(o.items || []).length ? (o.items || []).map((item) => `<div class="muted">${item.name || '-'} · ${item.quantity || 0} ta · ${money(item.price || 0)}</div>`).join('') : '<div class="muted">Mahsulotlar topilmadi</div>'}
              <div class="muted">Manzil: ${o.customerAddress || o.addressText || o.location || '-'}</div>
              <div class="muted">To‘lov: ${paymentMethodLabel(o.paymentMethod)} / ${paymentStatusLabel(o.paymentStatus)}</div>
            </div>
          </details>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn gm-btn gm-btn-primary btn-primary" data-reorder="${o.orderNumber}" style="flex:1;">Yana buyurtma berish</button>
            <a class="btn gm-btn gm-btn-secondary btn-secondary" href="/track/${encodeURIComponent(o.orderNumber)}" target="_blank" style="text-align:center;flex:1;">Kuzatish</a>
          </div>
        </article>
      `).join('');
    }

    function renderCartBadge() {
      const q = totalQty();
      cartBadge.textContent = q;
      cartBadge.classList.toggle('hidden', q === 0);
      if (q > previousBadgeQty) {
        cartBadge.classList.add('pop');
        homeCartShortcutBadge?.classList.add('pop');
        setTimeout(() => {
          cartBadge.classList.remove('pop');
          homeCartShortcutBadge?.classList.remove('pop');
        }, 280);
      }
      if (homeCartShortcutBadge) {
        homeCartShortcutBadge.textContent = q;
      }
      previousBadgeQty = q;
    }

    function upsellCardTemplate(p) {
      return `
        <article class="upsell-card" data-action="open-product" data-product-id="${p.id}">
          <img class="cart-item-thumb" src="${p.image_url}" alt="${p.name}" loading="lazy" decoding="async" />
          <h6>${p.name}</h6>
          <div class="list-row"><span class="price">${money(p.price)}</span><button class="upsell-quick-btn" data-action="add-to-cart" data-id="${p.id}">+ Qo‘shish</button></div>
        </article>
      `;
    }

    function getRelatedProducts(product) {
      const sameCategory = products.filter((item) => item.id !== product.id && normalizedCategoryName(item.category) === normalizedCategoryName(product.category));
      const fallback = products.filter((item) => item.id !== product.id);
      const source = sameCategory.length ? sameCategory : fallback;
      return source.slice(0, 4);
    }

    function getCartUpsellProducts() {
      if (!cartItemsSnapshot.length) return [];
      const inCart = new Set(cartItemsSnapshot.map((item) => item.id));
      return products
        .filter((p) => !inCart.has(p.id) && Number(p.stock || 0) > 0)
        .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
        .slice(0, 4);
    }

    function renderModal() {
      if (!activeModalProductId) return;
      const p = products.find((x) => x.id === activeModalProductId);
      if (!p) return;
      const stock = Number(p.stock ?? 0);
      const oldPrice = Number(p.oldPrice || 0);
      const price = Number(p.price || 0);
      const hasDiscount = oldPrice > price && price > 0;
      const discountPercent = hasDiscount ? Math.max(1, Math.round(((oldPrice - price) / oldPrice) * 100)) : 0;
      const etaText = p.etaText || homePayload?.home_settings?.deliveryTimeText || '20 daqiqa';
      modalName.textContent = p.name;
      modalCategory.textContent = `Kategoriya: ${normalizedCategoryName(p.categoryDisplayName || p.category)}`;
      modalPrice.textContent = money(p.price);
      modalStickyPrice.textContent = money(p.price);
      modalOldPrice.textContent = hasDiscount ? money(oldPrice) : '';
      modalOldPrice.style.display = oldPrice > 0 ? 'block' : 'none';
      modalEta.textContent = `🚚 ${etaText}`;
      modalAvailability.textContent = stock > 0 ? 'Mavjud' : "Omborda yo'q";
      modalAvailability.className = `gm-chip ${stock > 0 ? 'gm-chip--success' : 'gm-chip--warning'}`;
      modalTrustDelivery.textContent = `🚚 ${etaText}da yetkazib beramiz`;
      modalDescription.textContent = p.description || p.subtitle || `${p.name} uchun buyurtma berishingiz mumkin.`;
      modalSpecs.innerHTML = `<div class="spec-row"><span>Kategoriya:</span><strong>${normalizedCategoryName(p.categoryDisplayName || p.category)}</strong></div>
        <div class="spec-row"><span>Qoldiq:</span><strong>${stock > 0 ? stock : 0} ta</strong></div>
        ${p.code ? `<div class="spec-row"><span>Kod:</span><strong>${p.code}</strong></div>` : ''}`;
      
      modalImageBox.innerHTML = p.image_url ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" decoding="async" />` : '<div class="muted">Rasm mavjud emas</div>';
      if (hasDiscount) {
        modalImageBox.insertAdjacentHTML('beforeend', `<span class="gm-chip gm-chip--delivery product-discount">-${discountPercent}%</span>`);
      }
      const related = getRelatedProducts(p);
      if (related.length) {
        modalRecommendations.innerHTML = related.map(upsellCardTemplate).join('');
        modalRecommendations.style.display = 'grid';
        modalUpsellTitle.style.display = 'block';
      } else {
        modalRecommendations.innerHTML = '';
        modalRecommendations.style.display = 'none';
        modalUpsellTitle.style.display = 'none';
      }
      const modalQtyNow = qtyOf(p.id);
      if (modalQtyNow > 0) {
        modalQty.innerHTML = `<div class="qty" style="width:100%;height:40px;grid-template-columns:44px 1fr 44px;">${makeQtyControls(p.id)}</div>`;
      } else {
        modalQty.innerHTML = `<div class="qty" style="width:100%;height:40px;grid-template-columns:44px 1fr 44px;">${makeQtyControls(p.id)}</div>`;
      }
      modalAddBtn.style.display = 'none';
    }

    function renderAll() {
      renderHomeCategories();
      renderHome();
      renderSearch();
      renderCart();
      renderCheckout();
      renderCartBadge();
      renderModal();
      renderActiveOrderCard();
      renderProfileOrders();
    }

    function openProductModal(id) {
      activeModalProductId = id;
      renderModal();
      modalOverlay.classList.add('show');
      history.pushState({ type: 'modal' }, '');
    }

    function closeProductModal() {
      modalOverlay.classList.remove('show');
      modalImageBox?.classList.remove('zoomed');
      activeModalProductId = null;
    }

    function closeLocationDeniedModal() {
      locationDeniedOverlay?.classList.remove('show');
    }

    function openLocationDeniedModal() {
      locationDeniedOverlay?.classList.add('show');
    }

    async function requestBrowserLocation() {
      if (!navigator.geolocation) {
        customerLocation.permissionDenied = true;
        renderCheckout();
        openLocationDeniedModal();
        return;
      }
      navigator.geolocation.getCurrentPosition(async (pos) => {
        customerLocation.lat = pos.coords.latitude;
        customerLocation.lng = pos.coords.longitude;
        customerLocation.accuracy = pos.coords.accuracy;
        customerLocation.permissionDenied = false;
        const geoAddress = await reverseGeocode(customerLocation.lat, customerLocation.lng);
        customerLocation.addressText = geoAddress || customerLocation.addressText || '';
        closeLocationDeniedModal();
        renderCheckout();
        showToast('Lokatsiya olindi');
      }, () => {
        customerLocation.permissionDenied = true;
        renderCheckout();
        openLocationDeniedModal();
      }, { enableHighAccuracy: true, timeout: 12000 });
    }

    function updateInlineBackTitle() {
      document.querySelectorAll('.view .title').forEach((el) => {
        const base = viewTitles[el.closest('.view')?.id];
        if (base) el.textContent = base;
      });
      if (activeModalProductId) return;
      const currentTitle = document.querySelector(`#${currentView} .title`);
      const canGoBack = currentView !== 'homeView' && (appNavStack.length > 1 || currentView === 'checkoutView' || currentView === 'cartView' || currentView === 'searchView');
      if (currentTitle && canGoBack && viewTitles[currentView]) currentTitle.textContent = `← ${viewTitles[currentView]}`;
    }

    function setView(viewId, { push = false } = {}) {
      document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === viewId));
      currentView = viewId;
      document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === viewId));
      bottomNav.classList.toggle('hidden', viewId === 'checkoutView' || viewId === 'successView');
      if (push && appNavStack[appNavStack.length - 1] !== viewId) {
        appNavStack.push(viewId);
        history.pushState({ type: 'view', viewId }, '');
      }
      updateInlineBackTitle();
    }

    function appGoBack() {
      if (activeModalProductId) return closeProductModal();
      if (currentView === 'checkoutView') return setView('cartView');
      if (currentView === 'successView') return setView('homeView');
      if (appNavStack.length > 1) {
        appNavStack.pop();
        return setView(appNavStack[appNavStack.length - 1]);
      }
      return setView('homeView');
    }

    async function refreshOrderStatus() {
      if (!latestOrderNumber) return;
      try {
        const data = await api(`/orders/${encodeURIComponent(latestOrderNumber)}/track`);
        successOrderStatus.textContent = `Status: ${orderStatusLabel(data.order?.status)}`;
        if (!isActiveOrderStatus(data.order?.status)) {
          pushOrderHistory(data.order);
          activeOrderNumber = '';
          localStorage.removeItem('activeOrderNumber');
        }
        if (data.order?.status === 'delivered' || data.order?.status === 'cancelled') {
          clearInterval(orderStatusTimer);
          orderStatusTimer = null;
        }
      } catch (e) {
        // keep silent, next poll will retry
      }
    }

    async function initializeAppData() {
      try {
        const skeleton = '<div class="skeleton-grid"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';
        homeProducts.innerHTML = skeleton;
        searchResults.innerHTML = skeleton;
        cartUpsellGrid.innerHTML = skeleton;
        await loadProfile();
        await Promise.all([loadHomePayload(), loadProducts({ reset: true }), loadCart()]);
        manualAddress.value = currentUser?.address || '';
        customerLocation.addressText = manualAddress.value.trim();
        renderAll();
      } catch (error) {
        showToast(error.message || 'Maʼlumotni yuklashda xatolik');
      }
    }

    openRegisterBtn?.addEventListener('click', async () => {
      localStorage.setItem('onboardingSeen', 'true');
      document.getElementById('introScreen')?.classList.add('fade-out');
      setTimeout(async () => {
        phone.classList.add('show-app');
        setView('homeView');
        await initializeAppData();
      }, 260);
    });

    closeAuthSheetBtn?.addEventListener('click', () => {
      authSheetOverlay.classList.remove('show');
    });

    authSheetOverlay?.addEventListener('click', (e) => {
      if (e.target === authSheetOverlay) authSheetOverlay.classList.remove('show');
    });

    submitAuthBtn?.addEventListener('click', async () => {
      try {
        const ok = await submitAuth();
        if (!ok) return;
        phone.classList.add('show-app');
        setView('homeView');
        await initializeAppData();
      } catch (error) {
        showToast(error.message || 'Auth xatolik');
      }
    });

    requestOtpBtn?.addEventListener('click', async () => {
      try {
        await requestOtpCode();
      } catch (error) {
        showToast(error.message || 'OTP yuborishda xatolik');
      }
    });

    promoCodeInput?.addEventListener('change', previewPromoDiscount);

    verifyOtpBtn?.addEventListener('click', async () => {
      try {
        await verifyOtpCode();
      } catch (error) {
        showToast(error.message || 'OTP tekshirishda xatolik');
      }
    });

    logoutBtn?.addEventListener('click', () => {
      localStorage.removeItem('globusUser');
      localStorage.removeItem('authToken');
      currentUser = null;
      activeOrderNumber = '';
      localStorage.removeItem('activeOrderNumber');
      phone.classList.remove('show-app');
      showToast("Siz tizimdan chiqdingiz");
      renderProfileOrders();
    });

    profileRegisterBtn?.addEventListener('click', () => {
      authSheetOverlay.classList.add('show');
    });

    profileOrders?.addEventListener('click', async (e) => {
      const reorderBtn = e.target.closest('[data-reorder]');
      if (!reorderBtn) return;
      try {
        await reorderFromOrder(reorderBtn.dataset.reorder);
      } catch (error) {
        showToast(error.message || 'Qayta buyurtmada xatolik');
      }
    });


    profileMenuCard?.addEventListener('click', (e) => {
      const item = e.target.closest('[data-profile-action]');
      if (!item) return;
      const action = item.dataset.profileAction;
      if (action === 'orders') { setView('profileView', { push: true }); return; }
      if (action === 'payments') {
        openProfileAction('To‘lov usullari', '<p class="muted">Naqd — buyurtma yetkazilganda to‘lov.</p><p class="muted">Payme — onlayn to‘lov (kutilmoqda holatida boshlanadi).</p><p class="muted">Click — Click havola orqali to‘lov.</p>');
      }
      if (action === 'addresses') {
        openProfileAction('Manzillarim', `<input id="profileAddressInput" class="auth-input" placeholder="Manzil" value="${currentUser?.address || ''}" /><button class="btn gm-btn gm-btn-primary btn-primary" id="saveProfileAddressBtn" style="margin-top:10px;">Saqlash</button>`);
      }
      if (action === 'promos') {
        openProfileAction('Promokodlarim', '<input id="profilePromoInput" class="auth-input" placeholder="Promo kod" /><p class="muted" style="margin-top:8px;">Promo tizimi tez orada faollashadi.</p>');
      }
      if (action === 'notifications') {
        openProfileAction('Xabarnomalar', '<p class="muted">Hozircha xabarnomalar yo‘q</p>');
      }

      if (action === 'wholesale') {
        openProfileAction('Оптовый мижоз', '<input id="wsName" class="auth-input" placeholder="Ism" /><input id="wsPhone" class="auth-input" placeholder="Telefon" style="margin-top:8px;" /><input id="wsBiz" class="auth-input" placeholder="Biznes nomi" style="margin-top:8px;" /><input id="wsNote" class="auth-input" placeholder="Izoh" style="margin-top:8px;" /><button class="btn gm-btn gm-btn-primary btn-primary" id="wsApplyBtn" style="margin-top:10px;">Ariza yuborish</button><hr style="margin:10px 0;border-color:#eee;"><input id="wsLogin" class="auth-input" placeholder="Wholesale login" /><input id="wsPassword" type="password" class="auth-input" placeholder="Parol" style="margin-top:8px;" /><button class="btn gm-btn gm-btn-secondary btn-secondary" id="wsLoginBtn" style="margin-top:10px;">Wholesale kirish</button>');
      }
      if (action === 'help') {
        openProfileAction('Yordam', `<p class="muted">Qo‘llab-quvvatlash: <a href="tel:+998900000000">+998 90 000 00 00</a></p><p class="muted">Telegram: <a target="_blank" href="${COURIER_TELEGRAM_LINK}">Guruhga o‘tish</a></p>`);
      }
      if (action === 'courier') {
        const status = localStorage.getItem('courierApplicationStatus') || '';
        openProfileAction('Kuryer bo‘lish', `<input id="courierName" class="auth-input" placeholder="Ism" value="${currentUser?.name || ''}" />
          <input id="courierPhone" class="auth-input" placeholder="Telefon" value="${currentUser?.phone || ''}" style="margin-top:8px;" />
          <input id="courierCity" class="auth-input" placeholder="Shahar" style="margin-top:8px;" />
          <select id="courierTransport" class="auth-input" style="margin-top:8px;"><option value="piyoda">Piyoda</option><option value="velosiped">Velosiped</option><option value="skuter">Skuter</option><option value="mashina">Mashina</option></select>
          <input id="courierNote" class="auth-input" placeholder="Izoh (ixtiyoriy)" style="margin-top:8px;" />
          <button class="btn gm-btn gm-btn-primary btn-primary" id="courierSubmitBtn" style="margin-top:10px;">Ariza yuborish</button>
          <p class="muted" style="margin-top:8px;">${status === 'approved' ? 'Siz kuryer sifatida tasdiqlandingiz' : (status === 'pending' ? 'Ko‘rib chiqilmoqda' : '')}</p>
          ${status === 'approved' ? `<a class="btn gm-btn gm-btn-secondary btn-secondary" style="margin-top:8px;display:inline-flex;" target="_blank" href="${COURIER_TELEGRAM_LINK}">Telegram guruhga o‘tish</a>` : ''}`);
      }
    });

    profileActionBody?.addEventListener('click', async (e) => {
      if (e.target.id === 'saveProfileAddressBtn') {
        const address = String(document.getElementById('profileAddressInput')?.value || '').trim();
        if (currentUser) {
          currentUser.address = address;
          localStorage.setItem('globusUser', JSON.stringify(currentUser));
          await api('/profile', { method: 'PUT', body: JSON.stringify({ name: currentUser.name, phone: currentUser.phone, address }) });
          renderAll();
        }
        showToast('Manzil saqlandi');
        closeProfileAction();
      }
      if (e.target.id === 'courierSubmitBtn') {
        await api('/courier/apply', { method:'POST', body: JSON.stringify({ name: document.getElementById('courierName')?.value, phone: document.getElementById('courierPhone')?.value, city: document.getElementById('courierCity')?.value, transport: document.getElementById('courierTransport')?.value, note: document.getElementById('courierNote')?.value }) });
        localStorage.setItem('courierApplicationStatus', 'pending');
        showToast('Arizangiz yuborildi');
        closeProfileAction();
      }
      if (e.target.id === 'wsApplyBtn') {
        await api('/wholesale/apply', { method:'POST', body: JSON.stringify({ name: document.getElementById('wsName')?.value, phone: document.getElementById('wsPhone')?.value, businessName: document.getElementById('wsBiz')?.value, note: document.getElementById('wsNote')?.value }) });
        showToast('Оптовая заявка yuborildi');
      }
      if (e.target.id === 'wsLoginBtn') {
        const out = await api('/wholesale/login', { method:'POST', body: JSON.stringify({ login: document.getElementById('wsLogin')?.value, password: document.getElementById('wsPassword')?.value }) });
        localStorage.setItem('wholesaleToken', out.wholesaleToken || '');
        showToast('Оптовый режим yoqildi');
        closeProfileAction();
        await initializeAppData();
      }
    });

    closeProfileActionBtn?.addEventListener('click', closeProfileAction);
    profileActionOverlay?.addEventListener('click', (e) => { if (e.target === profileActionOverlay) closeProfileAction(); });

    document.getElementById('openSearchBtn').addEventListener('click', () => {
      setView('searchView', { push: true });
      selectedCategory = null;
      selectedCategoryLabel = '';
      catalogMode = 'categories';
      searchInput.value = '';
      renderSearch();
      searchInput.focus();
    });
    homeCartShortcut?.addEventListener('click', () => setView('cartView', { push: true }));

    searchInput.addEventListener('input', renderSearch);
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      renderSearch();
      searchInput.focus();
    });
    categoryBackBtn.addEventListener('click', () => {
      selectedCategory = null;
      selectedCategoryLabel = '';
      catalogMode = 'categories';
      searchInput.value = '';
      renderSearch();
    });

    bottomNav.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      if (!requireAuthOrIntro()) return;
      setView(tab.dataset.view, { push: true });
      if (tab.dataset.view === 'searchView') {
        selectedCategory = null;
        selectedCategoryLabel = '';
        catalogMode = 'categories';
        searchInput.value = '';
        renderSearch();
        searchInput.focus();
      }
    });

    document.querySelector('.bell')?.addEventListener('click', () => {
      showToast("Yangi bildirishnomalar tez orada qo'shiladi");
    });
    document.getElementById('homeAllCategoriesLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      setView('searchView', { push: true });
      catalogMode = 'categories';
      selectedCategory = null;
      selectedCategoryLabel = '';
      searchInput.value = '';
      renderSearch();
    });
    cartEmptyCta?.addEventListener('click', () => {
      setView('searchView', { push: true });
      catalogMode = 'categories';
      selectedCategory = null;
      selectedCategoryLabel = '';
      searchInput.value = '';
      renderSearch();
    });

    document.getElementById('homeMoreProductsLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      setView('searchView', { push: true });
      catalogMode = 'categories';
      selectedCategory = null;
      selectedCategoryLabel = '';
      searchInput.value = '';
      renderSearch();
    });

    document.addEventListener('click', async (e) => {
      const toastTrigger = e.target.closest('[data-toast]');
      if (toastTrigger) {
        e.preventDefault();
        showToast(toastTrigger.dataset.toast);
      }
      const actionEl = e.target.closest('[data-action]');
      const action = actionEl?.dataset.action;

      try {
        if (action === 'remove-from-cart') {
          e.preventDefault();
          e.stopPropagation();
          await setQty(actionEl.dataset.id, 0, false);
          return;
        }
        if (action === 'add-to-cart') {
          e.preventDefault();
          e.stopPropagation();
          const id = actionEl.dataset.id;
          const current = qtyOf(id);
          actionEl.classList.add('bounce');
          actionEl.classList.add('added');
          setTimeout(() => actionEl.classList.remove('bounce'), 450);
          setTimeout(() => actionEl.classList.remove('added'), 500);
          await setQty(id, current + 1, true);
          return;
        }
        if (action === 'qty-plus') {
          e.preventDefault();
          e.stopPropagation();
          const id = actionEl.dataset.id;
          const p = products.find((x) => x.id === id);
          const stock = Number(p?.stock ?? 0);
          if (stock <= 0) {
            showToast("Omborda yo'q");
            return;
          }
          if (qtyOf(id) >= stock) {
            showToast('Maksimal qoldiqga yetdi');
            return;
          }
          await setQty(id, qtyOf(id) + 1, true);
          return;
        }

        if (action === 'qty-minus') {
          e.preventDefault();
          e.stopPropagation();
          const id = actionEl.dataset.id;
          await setQty(id, qtyOf(id) - 1, false);
          return;
        }
      } catch (error) {
        showToast(error.message || 'Xatolik yuz berdi');
        return;
      }

      const card = e.target.closest('[data-action="open-product"]');
      if (card && !e.target.closest('[data-action="add-to-cart"], [data-action="qty-plus"], [data-action="qty-minus"], [data-action="remove-from-cart"], [data-action="favorite"], .qty')) {
        openProductModal(card.dataset.productId);
        return;
      }

      const categoryCard = e.target.closest('[data-category]');
      if (categoryCard) {
        const key = categoryCard.dataset.category;
        if (key === 'all') {
          selectedCategory = null;
          selectedCategoryLabel = '';
          catalogMode = 'categories';
        } else {
          selectedCategory = key;
          selectedCategoryLabel = categoryCard.dataset.categoryLabel || categoryCard.dataset.category;
          catalogMode = 'category';
        }
        searchInput.value = '';
        renderSearch();
        return;
      }

      const homeCategoryCard = e.target.closest('[data-home-category]');
      if (homeCategoryCard) {
        selectedCategory = homeCategoryCard.dataset.homeCategory;
        selectedCategoryLabel = homeCategoryCard.dataset.homeCategoryLabel || homeCategoryCard.dataset.homeCategory;
        catalogMode = 'category';
        setView('searchView', { push: true });
        searchInput.value = '';
        renderSearch();
      }
    });

    closeModalBtn.addEventListener('click', closeProductModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeProductModal();
    });
    window.addEventListener('popstate', () => appGoBack());

    // modalAddBtn intentionally disabled to avoid duplicate add action

    document.getElementById('orderBtn').addEventListener('click', () => {
      if (!requireAuthOrIntro()) return;
      if (totalQty() === 0) {
        showToast("Savat bo'sh");
        return;
      }
      setView('checkoutView');
      renderCheckout();
    });

    document.querySelectorAll('.pay-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedPayment = btn.dataset.payment;
        document.querySelectorAll('.pay-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderCheckout();
      });
    });

    document.getElementById('confirmOrderBtn').addEventListener('click', async () => {
      addressValidationError.style.display = 'none';
      paymentValidationError.style.display = 'none';
      checkoutDiscountRow.style.display = promoDiscountPreview > 0 ? 'flex' : 'none';
      checkoutDiscount.textContent = `-${money(promoDiscountPreview)}`;
      if (totalQty() === 0) {
        showToast("Savat bo'sh");
        return;
      }
      if (!currentUser?.phone) {
        showToast("Avval ro‘yxatdan o‘ting");
        paymentValidationError.textContent = "Avval ro‘yxatdan o‘ting";
        paymentValidationError.style.display = 'block';
        return;
      }
      if (!requireAuthOrIntro()) return;
      if (!selectedPayment) {
        paymentValidationError.textContent = "To‘lov turini tanlang";
        paymentValidationError.style.display = 'block';
        showToast("To'lov turini tanlang");
        return;
      }
      customerLocation.addressText = manualAddress.value.trim() || customerLocation.addressText || '';
      customerLocation.landmarkText = landmarkInput.value.trim();
      const deliveryState = getDeliveryState();
      if (!deliveryState.hasGeo && !customerLocation.addressText) {
        addressValidationError.textContent = "Manzilni kiriting yoki lokatsiyani yoqing";
        addressValidationError.style.display = 'block';
        showToast("Lokatsiyani kiriting yoki manzilni to‘ldiring");
        return;
      }
      if (!deliveryState.hasGeo || !Number.isFinite(Number(deliveryState.deliveryPrice))) {
        addressValidationError.textContent = "Yetkazib berish narxini hisoblash uchun lokatsiyani aniqlang";
        addressValidationError.style.display = 'block';
        showToast("Yetkazib berish narxini hisoblash uchun lokatsiyani aniqlang");
        return;
      }

      try {
        let paymentProofUrl = '';
        if (selectedPayment === 'cash') {
          if (!cashAgreementCheckbox.checked) {
            paymentValidationError.textContent = "Naqd to‘lov uchun rozilikni tasdiqlang";
            paymentValidationError.style.display = 'block';
            showToast("Naqd to‘lov shartlarini tasdiqlang");
            return;
          }
        }
        const checkoutTotals = getCheckoutTotalsSnapshot();
        const order = await api('/orders', {
          method: 'POST',
          body: JSON.stringify({
            paymentMethod: selectedPayment,
            payment_method: selectedPayment,
            paymentStatus: selectedPayment === 'cash' ? 'unpaid' : 'pending',
            cashTermsAccepted: selectedPayment === 'cash',
            paymentProofUrl,
            cashAgreementTextVersion: selectedPayment === 'cash' ? 'draft-v1' : '',
            cashAgreementAccepted: selectedPayment === 'cash' ? cashAgreementCheckbox.checked : false,
            cashAgreementAcceptedAt: selectedPayment === 'cash' ? new Date().toISOString() : null,
            location: resolvePreferredAddress() || 'Manzil kiritilmagan',
            locationLat: customerLocation.lat,
            locationLng: customerLocation.lng,
            locationAccuracy: customerLocation.accuracy,
            addressText: customerLocation.addressText,
            landmarkText: customerLocation.landmarkText,
            deliveryTime: '',
            deliveryPrice: deliveryState.deliveryPrice,
            delivery_address: resolvePreferredAddress() || 'Manzil kiritilmagan',
            delivery_lat: customerLocation.lat,
            delivery_lng: customerLocation.lng,
            delivery_distance_km: Number(deliveryState.distanceKm.toFixed(2)),
            promoCode: String(promoCodeInput?.value || '').trim()
          })
        });

        lastOrderData = {
          ...checkoutTotals,
          paymentMethod: selectedPayment || '-',
          address: resolvePreferredAddress(),
          orderNumber: order.orderNumber || '-',
          status: order.status
        };

        await Promise.all([loadProducts({ reset: true }), loadCart()]);
        if (selectedPayment === 'click') {
          const amountTiyin = Math.round(Number((checkoutTotals?.finalTotal || 0)) * 100);
          // TODO: replace redirect-only flow with Click callback/webhook confirmation.
          window.open(`https://indoor.click.uz/pay?id=081328&t=${amountTiyin}`, '_blank');
        }
        cart = {};
        renderAll();
        latestOrderNumber = order.orderNumber || '';
        activeOrderNumber = latestOrderNumber;
        localStorage.setItem('activeOrderNumber', activeOrderNumber);
        successOrderNumber.textContent = `Buyurtma: ${lastOrderData?.orderNumber || latestOrderNumber || '-'}`;
        successOrderTime.textContent = `Vaqt: ${new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`;
        successPaymentMethod.textContent = `To‘lov turi: ${paymentMethodLabel(lastOrderData?.paymentMethod)}`;
        successAddress.textContent = `Manzil: ${lastOrderData?.address || '-'}`;
        successTotal.textContent = Number.isFinite(Number(lastOrderData?.finalTotal))
          ? `Jami: ${money(Math.max(0, Number(lastOrderData.finalTotal || 0)))}`
          : "Jami: Summani tekshirib bo‘lmadi";
        successOrderStatus.textContent = `To‘lov holati: ${paymentStatusLabel(order?.paymentStatus)} | Buyurtma: ${orderStatusLabel(order.status)}`;
        if (latestOrderNumber) {
          trackOrderBtn.style.display = 'inline-flex';
          trackOrderBtn.setAttribute('href', `/track/${encodeURIComponent(latestOrderNumber)}`);
        }
        if (orderStatusTimer) clearInterval(orderStatusTimer);
        orderStatusTimer = setInterval(refreshOrderStatus, 5000);
        refreshOrderStatus();
        setView('successView');
      } catch (error) {
        showToast(error.message || 'Buyurtmani yuborishda xatolik');
      }
    });

    document.getElementById('backHomeBtn').addEventListener('click', async () => {
      if (orderStatusTimer) {
        clearInterval(orderStatusTimer);
        orderStatusTimer = null;
      }
      await initializeAppData();
      setView('homeView');
      trackOrderBtn.style.display = 'none';
      showToast('Buyurtma yakunlandi');
    });


    document.getElementById('captureLocationBtn').addEventListener('click', requestBrowserLocation);
    retryLocationBtn?.addEventListener('click', requestBrowserLocation);
    manualLocationBtn?.addEventListener('click', () => {
      closeLocationDeniedModal();
      manualAddress?.focus();
    });
    locationDeniedOverlay?.addEventListener('click', (e) => {
      if (e.target === locationDeniedOverlay) closeLocationDeniedModal();
    });

    manualAddress.addEventListener('input', () => {
      customerLocation.addressText = manualAddress.value.trim();
      if (currentUser?.phone) {
        currentUser.address = customerLocation.addressText || currentUser.address || DEFAULT_LOCATION_ADDRESS;
        localStorage.setItem('globusUser', JSON.stringify(currentUser));
      }
      renderCheckout();
    });
    landmarkInput.addEventListener('input', renderCheckout);
    (async () => {
      await loadProfile();
      const onboardingSeen = localStorage.getItem('onboardingSeen') === 'true';
      if (isAuthed() || onboardingSeen) {
        phone.classList.add('show-app');
        setView('homeView');
        await initializeAppData();
      } else {
        phone.classList.remove('show-app');
      }
    })();
