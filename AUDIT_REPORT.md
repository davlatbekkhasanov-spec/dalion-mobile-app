# AUDIT REPORT — `index.html`

## Қамров
Ушбу аудит фақат `index.html` ичидаги мавжуд HTML/CSS/JS асосида қилинди. Код ўзгартирилмади.

---

## 1) Intro / Onboarding

**HTML элементлар:**
- `<section id="introScreen" class="screen intro">`
- `.intro-inner.premium-intro`, `.intro-chip`, `.intro-logo`, `.intro-title`, `.intro-sub`, `.intro-cards`, `.intro-cta`
- Асосий CTA: `<button id="openRegisterBtn">Xaridni boshlash</button>`

**CSS class/id:**
- `.intro`, `.intro-inner`, `.premium-intro`, `.intro-card`, `.intro-cta`, `#openRegisterBtn`
- Intro анимациялар: `@keyframes introLogo`, `introFade`, `introCard`

**JS функция/оқим:**
- `openRegisterBtn` click → auth sheet очилади (`authSheetOverlay.classList.add('show')`)
- App инициализацияси IIFE ва `initializeAppData()` орқали амалга ошади

**Ҳолати (ишлаяптими):**
- **Қисман ишлайди** (intro экран ва CTA бор).

**Муаммолар:**
- Intro ичида контент ҳаддан ташқари “визуал-only” блоклар (4 та бўш intro-card).
- Аccessibility: intro CTA ва контент учун ARIA/semantic role кам.

**Яхшилаш:**
- Intro cards учун реал preview контент ёки skeleton-дан фойдаланиш.
- Локализация ва ARIA-label қўшиш.

---

## 2) Registration/Auth Sheet

**HTML элементлар:**
- `<div id="authSheetOverlay" class="auth-sheet-overlay">`
- `<div id="authSheet" class="auth-sheet">`
- Input: `#authName`, `#authPhone`, `#otpCodeInput`
- Button: `#requestOtpBtn`, `#verifyOtpBtn`, `#submitAuthBtn`, `#closeAuthSheetBtn`
- Dev hint: `#devOtpHint`

**CSS class/id:**
- `.auth-sheet-overlay`, `.auth-sheet`, `.auth-sheet-head`, `.auth-input`, `.auth-sheet-close`

**JS функциялар:**
- `submitAuth()`
- `requestOtpCode()`
- `verifyOtpCode()`
- overlay close/open listeners

**Ҳолати:**
- **Ишлайди (API бор бўлса)**.

**Муаммолар:**
- Валидация UX минимал; хато сабаблари кўпроқ визуал кўрсатилиши мумкин.
- OTP оқими dev hint’га боғланган ҳолатда продакшн/тест ажратилиши аниқ эмас.

**Яхшилаш:**
- Телефон формати mask/normalize.
- OTP resend cooldown UI ni аниқ кўрсатиш.
- Error mapping’ни field-level қилиш.

---

## 3) Home

**HTML элементлар:**
- `<section id="homeView" class="view active">`
- Top header: `#homeBrandName`, `#homeLocation`, `#homeCartShortcut`
- Banner/promo: `#bannerCarousel`, `#promoCarousel`
- Product секциялар: `#homeProducts`, `#homeDiscountProducts`, `#homeFastProducts`, `#homeBestSellerProducts`, `#homeReorderProducts`

**CSS class/id:**
- `.home-top-sticky`, `.home-scroll`, `.promo`, `.products-grid`, `.gm-section-header`

**JS функциялар:**
- `loadHomePayload()`
- `renderHome()`
- `renderHomeCategories()`
- `setSectionVisibility()`

**Ҳолати:**
- **Қисман ишлайди** (маълумотга боғлиқ).

**Муаммолар:**
- Бир неча home section data empty бўлса тоза fallback контент йўқ.
- Inline style ва mixed design layers кўп.

**Яхшилаш:**
- Empty-state стандартлаштириш.
- Section config driven render қилиш.

---

## 4) Search

**HTML элементлар:**
- `<section id="searchView" class="view">`
- `#searchInput`, `#searchClearBtn`, `#searchResults`, `#searchEmpty`, `#catalogProductResultsTitle`

**CSS class/id:**
- `.catalog-search-sticky`, `.search-wrap`, `.search-input-lg`, `.search-clear-btn`

**JS функциялар:**
- `renderSearch()`
- search input listener
- category/list state орқали `catalogMode`

**Ҳолати:**
- **Ишлайди**.

**Муаммолар:**
- Query debouncing йўқ.
- Катта dataset’да filter performance пасайиши мумкин.

**Яхшилаш:**
- `input` учун debounce (150–250ms).
- Pre-index/search tokenization.

---

## 5) Categories

**HTML элементлар:**
- Home categories: `#homeCategories`
- Search category list: `#categoryResults`
- Back button: `#categoryBackBtn`

**CSS class/id:**
- `.cats`, `.cat`, `.cat-label`, `.category-grid`, `.category-card`, `.active`

**JS функциялар:**
- `getCategoryEntries()`
- `normalizeCategoryKey()`
- `productMatchesCategory()`
- `renderHomeCategories()` / `renderSearch()`

**Ҳолати:**
- **Ишлайди**.

**Муаммолар:**
- Категория normalization rule-based ва brittle (новый номлар қўшилса қийин).

**Яхшилаш:**
- API category taxonomy’га ўтиш.
- Category translation map марказлаштириш.

---

## 6) Products Grid

**HTML элементлар:**
- Барча grid контейнерлар: `.products-grid`
- Product card dynamic template: `.product`, `.image-box`, `.product-info`, `.quick-add-btn`, `.qty`

**CSS class/id:**
- `.products-grid`, `.product`, `.image-box`, `.quick-add-btn`, `.qty`, `.fav-btn`, `.discount-chip`

**JS функциялар:**
- `productCardTemplate(p)`
- `setQty(id, value, showAddToast)`
- `makeQtyControls(id)`

**Ҳолати:**
- **Ишлайди (маълумот келса)**.

**Муаммолар:**
- CSS override layer жуда кўп; maintenance қийин.
- Product card click ва quick-add click event delegation ўзаро мураккаб.

**Яхшилаш:**
- Card rendering componentize қилиш.
- CSS’ни modular/theme layer қилиб ажратиш.

---

## 7) Product Modal

**HTML элементлар:**
- `#productModalOverlay`, `#productModal`
- `#modalName`, `#modalCategory`, `#modalPrice`, `#modalOldPrice`, `#modalQty`, `#modalAddBtn`, `#modalRecommendations`

**CSS class/id:**
- `.overlay`, `.modal`, `.modal-head`, `.modal-image`, `.modal-sticky-cta`, `.modal-reco-grid`

**JS функциялар:**
- `openProductModal(id)`
- `closeProductModal()`
- `renderModal()`
- modal overlay click close

**Ҳолати:**
- **Ишлайди**.

**Муаммолар:**
- `const modalRating = document.getElementById('modalRating');` бор, лекин HTML’da `#modalRating` йўқ (dead ref).

**Яхшилаш:**
- Dead DOM ref’ларни тозалаш.
- Focus trap ва keyboard ESC handling’ни кучайтириш.

---

## 8) Cart

**HTML элементлар:**
- `#cartView`, `#cartItems`, `#cartEmpty`, `#cartSummary`
- `#cartSubtotal`, `#cartDelivery`, `#cartTotalPrice`, `#orderBtn`
- Upsell: `#cartUpsellWrap`, `#cartUpsellGrid`

**CSS class/id:**
- `.cart-item-card`, `.cart-item-thumb`, `.cart-remove-btn`, `.cart-summary-grid`

**JS функциялар:**
- `loadCart()`
- `renderCart()`
- `getCartUpsellProducts()`
- `renderCartBadge()`

**Ҳолати:**
- **Ишлайди (API ва state синхрон бўлса)**.

**Муаммолар:**
- Local `cartState` ва server cart parallel state бор — drift эҳтимоли.

**Яхшилаш:**
- Single source of truth стратегияси.
- Cart optimistic update rollback механизми.

---

## 9) Checkout

**HTML элементлар:**
- `#checkoutView`
- Delivery inputs: `#manualAddress`, `#landmarkInput`, `#promoCodeInput`
- Delivery info: `#checkoutDistance`, `#checkoutPrice`, `#checkoutGeo`
- Validation: `#addressValidationError`, `#checkoutValidationHint`

**CSS class/id:**
- `.checkout-delivery-card`, `.checkout-input`, `.checkout-sticky-cta`, `.field-error`

**JS функциялар:**
- `renderCheckout()`
- `getDeliveryState()`
- `calculateDeliveryPrice()`
- `previewPromoDiscount()`

**Ҳолати:**
- **Қисман ишлайди** (geo/browser permission ва API’га боғлиқ).

**Муаммолар:**
- Validation logic кўп шартли; UXда қайси майдон хато экани доим аниқ эмас.

**Яхшилаш:**
- Step-by-step checkout (address → payment → confirm).
- Field-level error summary.

---

## 10) Payment

**HTML элементлар:**
- `.payment-grid` ичида `.pay-btn[data-payment]` (`cash`, `payme`, `click`)
- `#paymentLinks`, `#paymentProofInput`, `#cashAgreementCheckbox`

**CSS class/id:**
- `.payment-grid`, `.pay-btn`, `.pay-btn.active`, `.payment-hint`

**JS функциялар:**
- `selectedPayment` state
- pay-btn click handler
- confirm handler ичида payment validation

**Ҳолати:**
- **Ишлайди (асосий сценарий)**.

**Муаммолар:**
- Payment proof ишлатилиши ва мажбурийлиги методга қараб қатъий эмас.
- Legal text draft ҳолатда.

**Яхшилаш:**
- Method-specific validation schema.
- Compliance-ready шартлар ва чекбокс логикаси.

---

## 11) Order Success

**HTML элементлар:**
- `#successView`
- `#successOrderNumber`, `#successOrderTime`, `#successPaymentMethod`, `#successAddress`, `#successTotal`
- `#trackOrderBtn`, `#backHomeBtn`

**CSS class/id:**
- `.success-card`, `.success-timeline`

**JS функциялар:**
- confirm order listener дан кейин `setView('successView')`
- `refreshOrderStatus()` билан боғлиқ статус янгилаш

**Ҳолати:**
- **Ишлайди**.

**Муаммолар:**
- Timeline статик; real-time progress UX чекланган.

**Яхшилаш:**
- WebSocket/polling-driven статус таймлайни.

---

## 12) Profile

**HTML элементлар:**
- `#profileView`
- `#profileUserCard`, `#profileMenuCard`, `#profileOrdersCard`, `#profileGuestCard`
- `#logoutBtn`, `#profileRegisterBtn`
- Profile action sheet: `#profileActionOverlay`, `#profileActionBody`

**CSS class/id:**
- `.profile-hero`, `.profile-avatar`, `.profile-menu .menu-item`

**JS функциялар:**
- `loadProfile()`
- `renderProfileOrders()`
- `openProfileAction()` / `closeProfileAction()`
- profile menu click handlers

**Ҳолати:**
- **Қисман ишлайди** (auth/data’га боғлиқ).

**Муаммолар:**
- Action sheet ичидаги айрим сценарийлар API’га қаттиқ боғланган.

**Яхшилаш:**
- Guest/auth state component separation.
- Profile actions учун аниқ route/state machine.

---

## 13) Bottom Navigation

**HTML элементлар:**
- `<nav id="bottomNav" class="bottom">`
- `.tab[data-view]` (`homeView`, `searchView`, `cartView`, `profileView`)
- `#cartBadge`

**CSS class/id:**
- `.bottom`, `.tab`, `.tab.active`, `.cart-badge`

**JS функциялар:**
- `setView(viewId, {push})`
- `appGoBack()`
- `bottomNav.addEventListener('click', ...)`

**Ҳолати:**
- **Ишлайди**.

**Муаммолар:**
- Checkout/success view навигацияси pastki tab model’дан ташқари ҳолатлар билан аралаш.

**Яхшилаш:**
- Навигация state machine (primary tabs vs flow screens) ажратиш.

---

## Кесим бўйича умумий техник топилмалар

1. **CSS override’лар жуда кўп:** бир хил селекторлар бир неча марта қайта ёзилган (design drift риск).
2. **DOM ref mismatch:** `modalRating` элементи JS’da чақирилади, HTML’da йўқ.
3. **Inline style кўп:** maintainability пасайган.
4. **State murakkabligi:** cart/local/api/profile/order ҳолатлари бир файлда марказлашган.
5. **Monolithic index.html:** HTML + CSS + JS катта бир файлда.

## Тавсия этилган кейинги босқич (код ўзгартиришдан олдин)

- UI блокларни component-level inventory қилиш (Intro/Auth/Home/Search/Cart/Checkout/Profile/Modal).
- JS функцияларни модулларга ажратиш режасини тузиш (`state`, `api`, `render`, `events`, `utils`).
- CSS учун layer стратегия (`base`, `components`, `overrides`, `theme`).
- DOM contract audit (id/class presence checker).


NEXT STEP READY
