# Architecture Audit & Production Refactor Plan (Phase 1)

## Scope and constraints
- Date: 2026-05-04
- This document is **audit + plan only** (no risky rewrites).
- Public backend API contracts stay unchanged.
- No courier Android app changes.

## 1) Current state (as-is)

### Runtime entrypoints
- Backend server bootstrap: `index.js`
- Customer frontend: `index.html` (large inline CSS + JS)
- Admin panel: `admin.html` (standalone page)
- Courier web page: `courier.html`
- Order tracker page: `track.html`

### Backend routing and controllers
- Main API router: `src/routes/api.routes.js`
- Controllers are flat under `src/controllers/`:
  - `auth.controller.js`
  - `cart.controller.js`
  - `order.controller.js`
  - `product.controller.js`
  - `integration.controller.js`
  - `admin.controller.js`
  - `courier.controller.js`
  - `payme.controller.js`

### Product/catalog and data flow
- Product repository: `src/repositories/product.repository.js`
- In-memory/file store and order/cart logic: `src/data/store.js`
- Home/catalog modules: `src/modules/catalog/index.js`

### Excel / DALION
- Excel parsing/import services:
  - `src/services/xlsx-import.service.js`
  - `src/services/excel.service.js`
  - `src/services/dalion-excel-import.service.js`
- DALION integration service:
  - `src/services/dalion.service.js`
- Integration endpoints are mixed in `integration.controller.js`

### Payments
- Payme JSON-RPC controller: `src/controllers/payme.controller.js`
- Payme transaction persistence: `src/repositories/payme-transaction.repository.js`
- Payment-related constants include Click enum entry but no dedicated Click controller yet.

### Auth/SMS OTP
- OTP service: `src/services/otp.service.js`
- SMS adapter (currently mock-oriented): `src/services/sms.service.js`

### Courier
- Courier web + API handled in current monolith (`courier.html`, `courier.controller.js`, order store functions).
- Native courier app exists in `android-courier/` (out of this refactor phase).

### Storage/DB
- DB layer: `src/db/index.js`, migrations under `src/db/migrations/`
- File storage adapter: `src/storage/file-storage.adapter.js`
- Mixed persistence strategy: in-memory store + file fallback (`src/data/store.js`) + partial DB usage.

---

## 2) Architectural problems found

1. **Frontend/backend concerns are mixed at repo root**
   - Root contains server, static frontend pages, and backend modules with no boundary.

2. **Customer frontend has oversized inline CSS/JS**
   - `index.html` contains large style + app logic blocks, hard to test and reuse.

3. **Duplicate style layers and drift risk**
   - Styles are split between inline `<style>` and `styles.css` with overlapping class semantics.

4. **State duplication risk still exists conceptually**
   - Cart is improved, but both `cartState` and compatibility `cart` object are present to support legacy handlers.

5. **Integration responsibilities are coupled**
   - Excel/DALION/DataMobile are grouped in single `integration.controller.js` instead of dedicated module boundaries.

6. **Demo/Kanstik legacy remains in codebase**
   - `src/services/kanstik-demo.service.js` exists and admin demo endpoints exist behind feature flag.

7. **Config hardening incomplete**
   - `src/config/env.js` exists, but not all sensitive/runtime knobs are centralized or validated.

8. **Security/ops risks**
   - Admin token in localStorage for admin page is convenient but high-risk for XSS.
   - OTP storage is in-memory map (no distributed/session durability).
   - Payment and order flows partially depend on in-memory/file store.

9. **Potential dead/low-use files**
   - `app.js` is not server entrypoint and only exposes UI helper object (verify need before removal).
   - `src/services/xlsx_parser.py` may be legacy now that runtime path is Node-based.

---

## 3) Target backend folder structure (production)

```text
src/
  config/
  common/
  modules/
    auth/
    users/
    products/
    categories/
    cart/
    orders/
    delivery/
    payments/
      payme/
      click/
      cash/
    courier/
    dalion/
    excel/
    sms/
  repositories/
  db/
  services/
```

### Mapping intent (no moves in Phase 1)
- `controllers/*.js` => split per module as route handlers/use-cases.
- `integration.controller.js` => separate `dalion/`, `excel/`, `delivery/` integration handlers.
- `payme.controller.js` => `modules/payments/payme/`.
- Future Click implementation => `modules/payments/click/`.
- OTP/SMS => `modules/auth/` + `modules/sms/` service adapters.

---

## 4) Migration plan (safe, incremental)

### Phase 2
- Introduce module-local routers while preserving old URL paths.
- Create `common/http` response helpers and validation layer.
- Extract frontend API client and state to dedicated JS files (no UI redesign).

### Phase 3
- Split integration controller into DALION/Excel/DataMobile modules.
- Add config schema validation (required env checks at boot).
- Introduce service interfaces for DALION, Excel importer, SMS providers.

### Phase 4
- Persist cart/order/auth state in DB-backed repositories.
- Keep `store.js` only as fallback during migration; then deprecate.
- Add idempotency + audit trail for payment and order status transitions.

### Phase 5
- Finish Click Merchant API support with separate module and tests.
- Harden admin auth/session flow (short-lived tokens, rotation, optional RBAC).

---

## 5) DALION integration plan
- DALION becomes authoritative product source in production mode.
- Import strategy:
  1. DALION sync scheduled + manual trigger endpoint.
  2. Upsert by stable external ID/SKU.
  3. Source tagging (`dalion`) retained for reconciliation.
  4. Conflict policy documented (DALION overrides mutable catalog fields except local merchandising overrides if explicitly configured).

## 6) Excel temporary source plan
- Excel remains temporary bootstrap/fallback source until DALION sync SLA is stable.
- Guardrails:
  - Require admin token, strict schema validation, and import report.
  - Preserve source metadata (`excel`) for lineage and rollback.
  - Disable demo loaders by default in production.

## 7) Payme Merchant API plan
- Keep current JSON-RPC behavior and endpoint path stable.
- Move implementation to `modules/payments/payme/` with:
  - request validator
  - transaction service
  - repository adapter
  - unified error mapping
- Add replay/idempotency safeguards and structured logs.

## 8) SMS OTP plan
- Preserve endpoint contract (`request-otp`, `verify-otp`).
- Replace in-memory OTP map with pluggable storage (Redis/DB) for multi-instance safety.
- Add rate-limits, per-phone cooldown, attempt caps, and audit logs.

## 9) Security checklist (must-pass before production)
- [ ] Enforce strict env validation for payment/auth/admin secrets.
- [ ] Apply input validation for all write endpoints.
- [ ] Add rate limiting for auth/payment/courier location endpoints.
- [ ] Remove/lock demo loaders outside non-prod.
- [ ] Review XSS exposure (admin token in localStorage) and migrate to safer auth model.
- [ ] Enforce file upload type/size checks + malware scanning policy.
- [ ] Add structured logging with PII redaction.
- [ ] Add migration path from file store to persistent DB storage.

