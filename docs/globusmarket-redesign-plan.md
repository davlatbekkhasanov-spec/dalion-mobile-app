# GlobusMarket UI/UX Redesign Implementation Plan (Phased)

## 1) Current frontend architecture snapshot

The customer experience is currently implemented as a **single-page, single-file UI** in `index.html`:

- Visual styles are mostly inline inside one `<style>` block.
- App logic, state, rendering, and API requests are inline inside one `<script>` block.
- Views are conditionally shown by toggling `.view.active` (`homeView`, `searchView`, `cartView`, `profileView`, `checkoutView`, `successView`).
- Product/card/category/cart/checkout HTML is generated via template functions in script.

Tracking is currently a separate page in `track.html`.
Admin is separate in `admin.html`. Courier native app is separate in `android-courier`.

This means a safe redesign should **modularize without changing API contracts** and should avoid full rewrite in one PR.

---

## 2) Backend/API compatibility constraints (must not break)

Customer UI currently depends on these endpoints and flows:

- `GET /api/v1/home`
- `GET /api/v1/products` (paginated)
- `GET /api/v1/cart`, `PUT /api/v1/cart/items`
- `PUT /api/v1/profile`
- `POST /api/v1/auth/request-otp`, `POST /api/v1/auth/verify-otp`
- `POST /api/v1/orders` (+ tracking/status endpoints already used in page flow)
- `GET /api/v1/orders/:orderNumber/track`

The redesign should remain **contract-compatible**:
- Keep request payload keys and headers unchanged (`x-user-phone`).
- Keep existing payment mode branching and agreement logic.
- Keep location optional behavior (manual address fallback).
- Keep active order tracking poll behavior until improved by safe incremental refactor.

---

## 3) Files to change (planned)

## Phase 1 foundation (design system + reusable primitives)

### Existing files to modify
- `index.html`
  - Remove inline `<style>` and inline `<script>` progressively.
  - Keep semantic containers and `id` hooks initially to preserve behavior.
- `styles.css`
  - Replace current minimal stylesheet with full tokenized design system.
- `app.js`
  - Turn current placeholder into app bootstrap + module imports (or script loader fallback).

### New files to add
- `src/web/design/tokens.css`
  - Color, typography, radius, spacing, elevation tokens from spec.
- `src/web/design/base.css`
  - Reset, typography defaults, surfaces, layout primitives.
- `src/web/design/components.css`
  - Buttons, chips, badges, cards, form elements, skeleton loaders, empty/error blocks.
- `src/web/components/product-card.js`
  - Reusable product card renderer for Home/Search rails.
- `src/web/components/chips.js`
  - ETA chip, stock chip, discount chip, rating chip builders.
- `src/web/components/states.js`
  - Empty/error/skeleton reusable renderers.

## Phase 2 Home + Product Card + Category sections
- `src/web/views/home-view.js`
- `src/web/views/search-view.js`
- `src/web/components/category-grid.js`
- `src/web/components/rail-section.js`
- `src/web/services/home-adapter.js` (maps `/home` + `/products` data to UI-safe view models)

## Phase 3 Product Detail + sticky CTA
- `src/web/views/product-detail-sheet.js` (replace simple modal)
- `src/web/components/gallery.js`
- `src/web/components/reviews-summary.js`

## Phase 4 Cart + Checkout
- `src/web/views/cart-view.js`
- `src/web/views/checkout-view.js`
- `src/web/components/quantity-stepper.js`
- `src/web/components/order-summary.js`

## Phase 5 Success + Customer Tracking
- `src/web/views/success-view.js`
- `track.html` (layout refresh)
- `src/web/views/tracking-view.js` (shared status/timeline/fallback rendering)

## Phase 6 Polish
- `src/web/accessibility/a11y.js`
- `src/web/animations/motion.css`
- Responsive cleanup across `styles.css` + component CSS files.

> Note: If ESM/module loading is not currently configured for static serving, phase 1 can use IIFE namespace modules first, then migrate to ESM in a later low-risk infra PR.

---

## 4) Screens affected

1. `homeView` (search-first, promo hero, category grid, personalized rails)
2. `searchView` (category-first then filtered products)
3. Product detail modal/sheet (upgraded to premium PDP-like sheet)
4. `cartView`
5. `checkoutView`
6. `successView`
7. `track.html` customer live tracking page
8. Shared bottom nav and global feedback states (toast/loading/errors)

---

## 5) Design system specification mapping

Tokens to implement (exact values from brief):
- Primary `#5B4CFF`
- Delivery accent `#FF7A00`
- Success `#12B76A`
- Warning `#F79009`
- Error `#D92D20`
- Info `#0EA5E9`
- Text primary `#101828`
- Text secondary `#475467`
- Border `#E4E7EC`
- Surface `#FFFFFF`
- Surface alt `#F8FAFC`
- Card radius `16px`
- Bottom sheet radius `24px`
- Mobile outer padding `16px`
- Min tap target `48px`

Also add:
- semantic aliases (`--color-price`, `--color-stock-low`, etc.)
- elevation scale (`--shadow-sm/md/lg`)
- motion durations (`--motion-fast/base/slow`)
- skeleton shimmer tokens

---

## 6) Risk register and mitigations

### Risk A: Breaking API payload compatibility
- **Mitigation:** add adapter layer (`home-adapter.js`, `order-adapter.js`) and keep existing request methods untouched.

### Risk B: Cart/order flow regression
- **Mitigation:** keep existing `setQty`, cart snapshot logic, order submission shape; refactor UI wrappers first, behavior second.

### Risk C: Tracking null/null state
- **Mitigation:** centralized tracking-state guard; explicit fallback text: `Kurier lokatsiyasi aniqlanmoqda` when courier coordinates unavailable.

### Risk D: Large single-file refactor causing merge conflicts
- **Mitigation:** extraction in thin slices (styles first, then component renderers, then view controllers).

### Risk E: Accessibility regressions
- **Mitigation:** add a11y checklist gate per PR (contrast, focus order, text+icon errors, 48dp targets, keyboard traps for modal/sheet).

### Risk F: Performance drop on dense rails
- **Mitigation:** lazy image loading, capped initial rails, skeleton placeholders, avoid full re-render on every minor state change.

---

## 7) Safe phased PR plan

## PR-1 (Phase 1A): Design tokens + base components (no UX flow change)
- Introduce tokenized CSS and foundational components (button/chip/badge/card/skeleton/state).
- Wire only visual layer to existing markup IDs/classes.
- No endpoint or state logic changes.

**Acceptance:** existing flows still work exactly; visuals move toward clean light premium system.

## PR-2 (Phase 1B + 2A): Reusable Product Card + Home section shell
- Introduce reusable product card renderer with required metadata zones.
- Replace home product rendering function to use component.
- Add category grid redesign shell and promo/banner rail improvements.

**Acceptance:** home renders with richer cards; add-to-cart still uses existing handlers.

## PR-3 (Phase 2B): Personalized rails and discovery density
- Add rails: `Siz uchun`, `Bugungi chegirmalar`, `Tez yetkaziladi`, `Ko‘p sotilgan`, `Qayta buyurtma`.
- Use truthful data mapping only (no fake counters/scarcity).

**Acceptance:** rails degrade gracefully when data missing.

## PR-4 (Phase 3): Product detail premium sheet
- Replace simple modal with structured PDP sheet:
  gallery, trust signals, rating/review summary, ETA, stock, return guarantee, sticky CTA.

**Acceptance:** add-to-cart and quantity sync fully preserved.

## PR-5 (Phase 4A): Cart redesign
- Clean list, steppers, stock warnings, subtotal/delivery summary area.
- Add empty/error/skeleton states.

## PR-6 (Phase 4B): Checkout redesign
- One-page short checkout, minimal fields, saved address + mini map preview, clear total CTA.
- Keep current payment + proof + cash agreement backend contract.

## PR-7 (Phase 5): Success + tracking redesign
- Success screen with order number, ETA, tracking CTA, reorder/add-ons.
- Tracking page map-first + timeline + courier card + null-safe fallback.

## PR-8 (Phase 6): polish pass
- Motion polish, responsive tweaks, full accessibility pass, loading/empty/error hardening.

---

## 8) QA gates per phase

- API contract tests: cart add/update, checkout submit, order status polling.
- Visual regression snapshots for key screens.
- Accessibility checks: contrast, focus, target size, semantic status text.
- Failure mode checks:
  - home endpoint partial data
  - no product image
  - zero stock
  - geolocation denied
  - courier location missing

---

## 9) Recommended implementation order in current repo

1. Extract inline CSS to tokenized stylesheets first.
2. Introduce component render helpers while preserving current state variables.
3. Refactor one view at a time (`homeView` → `product detail` → `cart` → `checkout` → `success` → `track`).
4. Keep backend API adapter wrappers stable and centralized.
5. Final pass: motion, a11y, responsiveness, copy cleanup (Uzbek/Russian localization consistency).

This sequencing minimizes risk and aligns with production-safe incremental delivery.
