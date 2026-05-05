(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    phone: $('phone'),
    introScreen: $('introScreen'),
    openRegisterBtn: $('openRegisterBtn'),
    authSheetOverlay: $('authSheetOverlay'),
    closeAuthSheetBtn: $('closeAuthSheetBtn'),
    submitAuthBtn: $('submitAuthBtn'),
    authName: $('authName'),
    authPhone: $('authPhone'),
    searchInput: $('searchInput'),
    searchClearBtn: $('searchClearBtn'),
    homeProducts: $('homeProducts'),
    searchResults: $('searchResults'),
    homeCategories: $('homeCategories'),
    categoryResults: $('categoryResults'),
    categoryBackBtn: $('categoryBackBtn'),
    cartItems: $('cartItems'),
    cartEmpty: $('cartEmpty'),
    cartSummary: $('cartSummary'),
    cartTotalPrice: $('cartTotalPrice'),
    cartSubtotal: $('cartSubtotal'),
    cartDelivery: $('cartDelivery'),
    orderBtn: $('orderBtn'),
    checkoutItems: $('checkoutItems'),
    checkoutSubtotal: $('checkoutSubtotal'),
    checkoutDeliveryPrice: $('checkoutDeliveryPrice'),
    checkoutGrandTotal: $('checkoutGrandTotal'),
    checkoutTotal: $('checkoutTotal'),
    checkoutSavedAddress: $('checkoutSavedAddress'),
    manualAddress: $('manualAddress'),
    landmarkInput: $('landmarkInput'),
    checkoutAddressLabel: $('checkoutAddressLabel'),
    confirmOrderBtn: $('confirmOrderBtn'),
    backHomeBtn: $('backHomeBtn'),
    profileName: $('profileName'),
    profilePhone: $('profilePhone'),
    profileAddress: $('profileAddress'),
    profileOrders: $('profileOrders'),
    cartBadge: $('cartBadge'),
    homeCartShortcutBadge: $('homeCartShortcutBadge'),
    toast: $('toast'),
    homeCartShortcut: $('homeCartShortcut'),
    openSearchBtn: $('openSearchBtn'),
    cartEmptyCta: $('cartEmptyCta'),
    bottomNav: $('bottomNav')
  };

  const state = {
    products: [],
    categories: [],
    cart: {},
    favorites: {},
    selectedCategory: 'all',
    searchQuery: '',
    selectedPayment: 'cash',
    user: null,
    deliveryAddress: '',
    currentView: 'homeView'
  };

  const STORAGE = {
    cart: 'gm_cart', favorites: 'gm_favorites', user: 'globusUser'
  };

  const views = ['homeView', 'searchView', 'cartView', 'checkoutView', 'successView', 'profileView'];

  const money = (v) => `${Number(v || 0).toLocaleString('ru-RU')} so'm`;
  const safe = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function loadStorage() {
    state.cart = JSON.parse(localStorage.getItem(STORAGE.cart) || '{}');
    state.favorites = JSON.parse(localStorage.getItem(STORAGE.favorites) || '{}');
    state.user = JSON.parse(localStorage.getItem(STORAGE.user) || 'null');
    state.deliveryAddress = state.user?.address || '';
  }
  function saveStorage() {
    localStorage.setItem(STORAGE.cart, JSON.stringify(state.cart));
    localStorage.setItem(STORAGE.favorites, JSON.stringify(state.favorites));
    if (state.user) localStorage.setItem(STORAGE.user, JSON.stringify(state.user));
  }

  async function api(path) {
    try {
      const res = await fetch(`/api/v1${path}`);
      const data = await res.json();
      return data;
    } catch { return {}; }
  }

  async function loadInitialData() {
    const data = await api('/products?page=1&limit=200');
    state.products = (data.items || data.products || []).map((p) => ({
      ...p,
      id: Number(p.id),
      price: Number(p.price || 0),
      stock: Number(p.stock ?? 0),
      category: p.category || 'Boshqa',
      name: p.name || 'Mahsulot'
    }));
    const catSet = new Set(['all']);
    state.products.forEach((p) => catSet.add(p.category));
    state.categories = Array.from(catSet);
  }

  function filteredProducts() {
    let list = state.products;
    if (state.selectedCategory !== 'all') list = list.filter((p) => p.category === state.selectedCategory);
    if (state.searchQuery) list = list.filter((p) => p.name.toLowerCase().includes(state.searchQuery.toLowerCase()));
    return list;
  }

  function calculateTotals() {
    let subtotal = 0;
    let qty = 0;
    Object.entries(state.cart).forEach(([id, q]) => {
      const p = state.products.find((x) => x.id === Number(id));
      if (!p) return;
      qty += Number(q);
      subtotal += Number(q) * p.price;
    });
    const delivery = qty ? 12000 : 0;
    return { subtotal, delivery, total: subtotal + delivery, qty };
  }

  function addToCart(productId) {
    const p = state.products.find((x) => x.id === Number(productId));
    if (!p || p.stock === 0) return showToast('Сотувда йўқ');
    state.cart[p.id] = (state.cart[p.id] || 0) + 1;
    saveStorage();
    renderAll();
  }
  function removeFromCart(productId) {
    delete state.cart[productId];
    saveStorage();
    renderAll();
  }
  function increaseQty(productId) { addToCart(productId); }
  function decreaseQty(productId) {
    const id = Number(productId);
    if (!state.cart[id]) return;
    state.cart[id] -= 1;
    if (state.cart[id] <= 0) delete state.cart[id];
    saveStorage();
    renderAll();
  }

  function setView(viewId) {
    state.currentView = viewId;
    views.forEach((id) => {
      const el = $(id);
      if (el) el.classList.toggle('active', id === viewId);
    });
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === viewId));
    if (viewId === 'checkoutView') renderCheckout();
    if (viewId === 'profileView') renderProfile();
  }

  function productCard(p) {
    const qty = state.cart[p.id] || 0;
    const out = p.stock === 0;
    return `<article class="product" data-product-id="${p.id}">
      <div class="image-box">${p.image ? `<img src="${safe(p.image)}" alt="${safe(p.name)}"/>` : `<div class="image-fallback"><i>📦</i><span>${safe(p.name)}</span></div>`}</div>
      <div class="product-info">
        <h5>${safe(p.name)}</h5>
        <p class="price">${money(p.price)}</p>
        ${out ? `<button class="quick-add-btn" disabled>Сотувда йўқ</button>` : qty ? `<div class="qty"><button data-action="dec" data-id="${p.id}">−</button><span>${qty}</span><button data-action="inc" data-id="${p.id}">+</button></div>` : `<button class="quick-add-btn" data-action="add" data-id="${p.id}">Саватга</button>`}
      </div>
    </article>`;
  }

  function renderHome() { if (els.homeProducts) els.homeProducts.innerHTML = filteredProducts().slice(0, 20).map(productCard).join(''); }
  function renderCategories() {
    const tpl = state.categories.map((c) => `<button class="cat ${state.selectedCategory===c?'active':''}" data-category="${safe(c)}"><span class="cat-label">${c==='all'?'Barchasi':safe(c)}</span></button>`).join('');
    if (els.homeCategories) els.homeCategories.innerHTML = tpl;
    if (els.categoryResults) els.categoryResults.innerHTML = tpl;
  }
  function renderProducts() { if (els.searchResults) els.searchResults.innerHTML = filteredProducts().map(productCard).join(''); }
  function renderCart() {
    if (!els.cartItems) return;
    const items = Object.entries(state.cart).map(([id, qty]) => ({ p: state.products.find((x) => x.id===Number(id)), qty })).filter((x) => x.p);
    els.cartItems.innerHTML = items.map(({p, qty}) => `<div class="list-card cart-item-card"><div class="cart-item-title">${safe(p.name)}</div><div class="cart-item-meta"><strong>${money(p.price*qty)}</strong></div><div class="qty"><button data-action="dec" data-id="${p.id}">−</button><span>${qty}</span><button data-action="inc" data-id="${p.id}">+</button></div><button class="icon-btn" data-action="remove" data-id="${p.id}">Olib tashlash</button></div>`).join('');
    const t = calculateTotals();
    if (els.cartEmpty) els.cartEmpty.style.display = items.length ? 'none' : 'block';
    if (els.cartSummary) els.cartSummary.style.display = items.length ? 'block' : 'none';
    if (els.cartSubtotal) els.cartSubtotal.textContent = money(t.subtotal);
    if (els.cartDelivery) els.cartDelivery.textContent = money(t.delivery);
    if (els.cartTotalPrice) els.cartTotalPrice.textContent = money(t.total);
  }
  function renderCheckout() {
    const items = Object.entries(state.cart).map(([id, qty]) => ({ p: state.products.find((x) => x.id===Number(id)), qty })).filter((x) => x.p);
    if (els.checkoutItems) els.checkoutItems.innerHTML = items.map(({p, qty}) => `<div class="list-card"><div class="list-row"><span>${safe(p.name)} × ${qty}</span><strong>${money(p.price*qty)}</strong></div></div>`).join('');
    const t = calculateTotals();
    els.checkoutSubtotal && (els.checkoutSubtotal.textContent = money(t.subtotal));
    els.checkoutDeliveryPrice && (els.checkoutDeliveryPrice.textContent = money(t.delivery));
    els.checkoutGrandTotal && (els.checkoutGrandTotal.textContent = money(t.total));
    els.checkoutTotal && (els.checkoutTotal.textContent = `Jami: ${money(t.total)}`);
    els.checkoutSavedAddress && (els.checkoutSavedAddress.textContent = `Saqlangan manzil: ${state.deliveryAddress || '-'}`);
    els.checkoutAddressLabel && (els.checkoutAddressLabel.textContent = `Mijoz manzili: ${state.deliveryAddress || 'Manzil kiritilmagan'}`);
  }
  function renderProfile() {
    const user = state.user;
    if (els.profileName) els.profileName.textContent = user?.name || 'Foydalanuvchi';
    if (els.profilePhone) els.profilePhone.textContent = `Telefon: ${user?.phone || '-'}`;
    if (els.profileAddress) els.profileAddress.textContent = `Manzil: ${state.deliveryAddress || 'Manzil qo‘shilmagan'}`;
    if (els.profileOrders) els.profileOrders.innerHTML = '<p class="muted">Buyurtmalar tarixi tayyor emas</p>';
  }
  function updateBadges() {
    const qty = calculateTotals().qty;
    if (els.cartBadge) {
      els.cartBadge.textContent = String(qty);
      els.cartBadge.classList.toggle('hidden', qty === 0);
    }
    if (els.homeCartShortcutBadge) els.homeCartShortcutBadge.textContent = String(qty);
  }

  function renderAll() {
    renderCategories();
    renderHome();
    renderProducts();
    renderCart();
    renderCheckout();
    renderProfile();
    updateBadges();
  }

  function showToast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.remove('show'), 1200);
  }

  function bindEvents() {
    els.openRegisterBtn?.addEventListener('click', () => els.authSheetOverlay?.classList.add('show'));
    els.closeAuthSheetBtn?.addEventListener('click', () => els.authSheetOverlay?.classList.remove('show'));
    els.authSheetOverlay?.addEventListener('click', (e) => { if (e.target === els.authSheetOverlay) els.authSheetOverlay.classList.remove('show'); });
    els.submitAuthBtn?.addEventListener('click', () => {
      state.user = { name: els.authName?.value?.trim() || 'Foydalanuvchi', phone: els.authPhone?.value?.trim() || '-' , address: state.deliveryAddress };
      saveStorage();
      els.phone?.classList.add('show-app');
      els.authSheetOverlay?.classList.remove('show');
      renderProfile();
    });
    els.searchInput?.addEventListener('input', (e) => { state.searchQuery = e.target.value.trim(); renderAll(); });
    els.searchClearBtn?.addEventListener('click', () => { state.searchQuery=''; if (els.searchInput) els.searchInput.value=''; renderAll(); });
    els.manualAddress?.addEventListener('input', (e) => { state.deliveryAddress = e.target.value.trim(); if (state.user) state.user.address = state.deliveryAddress; saveStorage(); renderCheckout(); renderProfile(); });
    els.landmarkInput?.addEventListener('input', () => renderCheckout());
    els.bottomNav?.addEventListener('click', (e) => { const tab = e.target.closest('.tab'); if (!tab) return; setView(tab.dataset.view); });
    els.openSearchBtn?.addEventListener('click', () => setView('searchView'));
    els.homeCartShortcut?.addEventListener('click', () => setView('cartView'));
    els.cartEmptyCta?.addEventListener('click', () => setView('searchView'));
    els.orderBtn?.addEventListener('click', () => setView('checkoutView'));
    els.confirmOrderBtn?.addEventListener('click', () => { if (!calculateTotals().qty) return; showToast('Buyurtma qabul qilindi'); state.cart={}; saveStorage(); renderAll(); setView('successView'); });
    els.backHomeBtn?.addEventListener('click', () => setView('homeView'));

    document.addEventListener('click', (e) => {
      const act = e.target.closest('[data-action]');
      if (act) {
        const id = Number(act.dataset.id);
        if (act.dataset.action === 'add') addToCart(id);
        if (act.dataset.action === 'inc') increaseQty(id);
        if (act.dataset.action === 'dec') decreaseQty(id);
        if (act.dataset.action === 'remove') removeFromCart(id);
      }
      const cat = e.target.closest('[data-category]');
      if (cat) { state.selectedCategory = cat.dataset.category; renderAll(); }
    });
  }

  async function init() {
    loadStorage();
    await loadInitialData();
    bindEvents();
    if (state.user) els.phone?.classList.add('show-app');
    renderAll();
    setView('homeView');
  }

  init();
})();
