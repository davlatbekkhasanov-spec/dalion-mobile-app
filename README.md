# DALION Mobile App (Preview + API)

## Admin-protected Excel XLSX import

## Payme Merchant API endpoint

- `GET /api/payme` returns health JSON for browser checks.
- `POST /api/payme` — Payme **JSON-RPC 2.0** (Merchant API). Auth: HTTP Basic, username **`Paycom`**, password **`PAYME_SECRET_KEY`** (production).
- Register this URL in Payme Business / Merchant API settings as your checkout endpoint (use your public HTTPS origin).
- `account.order_id` must equal the customer **`orderNumber`** from GlobusMarket (same string as on `/track/:orderNumber`).
- Implemented methods: `CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction`, `CheckTransaction`, `GetStatement`.

Customer checkout link is generated server-side:

- `GET /api/v1/payments/payme/url?orderNumber=...&lang=uz|ru` — requires `x-user-phone` (same as app); returns `{ ok, url }` for `https://checkout.paycom.uz/...`.

### Railway variables for Payme

- **`PAYME_MERCHANT_ID`** — merchant id from Payme (used in checkout receipt and dashboard).
- **`PAYME_SECRET_KEY`** — production key; used as Basic **password** (login is always `Paycom`).
- **`PAYME_TEST_MODE`** — optional `true` together with **`PAYME_TEST_KEY`** for Payme test callbacks / sandbox parity.
- **`PAYME_RETURN_URL`** or **`PUBLIC_APP_URL`** — where the customer returns after Payme (`PUBLIC_APP_URL` is optional fallback base).

### Railway variables for SMS (DevSMS)

- `SMS_GATEWAY_MODE` or `SMS_PROVIDER`: set to `devsms` for [DevSMS](https://devsms.uz/api/docs.php). Without `DEVSMS_API_KEY` / `SMS_API_KEY`, the server falls back to **log** mode (no outbound SMS).
- **Auto DevSMS (Railway-friendly):** if `SMS_GATEWAY_MODE` / `SMS_PROVIDER` are **unset**, `SMS_API_URL` is unset, and `DEVSMS_API_KEY` or `SMS_API_KEY` is set while `DEVSMS_API_URL` is the default (or another `*.devsms.uz` host), the gateway mode resolves to **devsms** automatically — no separate mode variable required.
- `DEVSMS_API_KEY` (or generic `SMS_API_KEY`): API token; sent per `DEVSMS_AUTH_MODE` (below).
- `DEVSMS_AUTH_MODE` (default `bearer`): `bearer` — `Authorization: Bearer …` only; `body` — include `api_key` in the JSON body only; `both` — header and body (for providers that expect both).
- `DEVSMS_SENDER_FROM`: sender ID (optional; default `4546` per provider docs).
- `DEVSMS_CALLBACK_URL`: optional delivery-status webhook URL (only if you consume callbacks).
- Optional: `DEVSMS_API_URL` (default `https://devsms.uz/api/send_sms.php`), `DEVSMS_OTP_MESSAGE_TEMPLATE` / `SMS_MESSAGE_TEMPLATE` with `{{code}}` (if unset, defaults to GlobusMarket Uzbek registration OTP body), `DEVSMS_SMS_TYPE` (e.g. `universal_otp`), `DEVSMS_SERVICE_NAME`, `DEVSMS_OTP_TEMPLATE_TYPE` (1–4, for universal OTP), `SMS_LOG_OTP_CODE=true` to log plaintext OTP (avoid in production).

If Payme keys are missing, `POST /api/payme` answers with a JSON-RPC configuration error until variables are set.

Endpoint:

`POST /api/v1/integrations/excel/import/products-xlsx`

This endpoint is protected with admin token header.
XLSX parsing runs in Node.js runtime (no python dependency).

### 1) Configure token in Railway

In Railway project:

- Open **Variables**
- Add key: `ADMIN_IMPORT_TOKEN`
- Set a strong secret value (example: `my-super-secret-token`)
- Redeploy

### 2) Call endpoint

Request requirements:

- `multipart/form-data`
- file field name: `file`
- header: `x-admin-token: <ADMIN_IMPORT_TOKEN>`

Example:

```bash
curl -X POST "https://<your-domain>/api/v1/integrations/excel/import/products-xlsx" \
  -H "x-admin-token: <ADMIN_IMPORT_TOKEN>" \
  -F "file=@/path/to/dalion.xlsx"
```

### Error behavior

- If token header missing/invalid: `403` JSON error
- If server token not configured: `500` JSON error

## Admin Panel

- URL: `/admin`
- Token is entered in admin page and stored in browser `localStorage` for admin API requests.
- Public customer app `/` does not expose admin controls.

### Admin v2 (GlobusMarket visual CMS)

- **URL:** `/admin-v2` or **`/admin-v2.html`** (both registered).
- **Styles:** `GET /admin-v2.css`
- Password login → JWT stored in browser `localStorage` under key **`globusAdminV2Jwt`** (Bearer token for admin-v2 APIs).

**Environment variables**

| Variable | Purpose |
|----------|---------|
| `ADMIN_V2_PASSWORD` | Login password (default **`8080`** if unset). Never logged server-side. |
| `ADMIN_V2_SECRET` | HMAC secret used to sign JWTs (change in production; default is a dev placeholder). |
| `ADMIN_V2_JWT_TTL_SEC` | Optional token lifetime in seconds (default **604800** = 7 days, capped at 30 days). |

**Cloudflare R2 (media uploads, optional)**  

When all of the following are set, banner images, shorts videos/thumbnails, and generic CMS images are stored in R2 and responses use public URLs under `R2_PUBLIC_URL`. If any variable is missing, the server keeps using local `uploads/` (handy for development).

- `R2_ACCOUNT_ID` — Cloudflare account ID used in the R2 S3 endpoint  
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — R2 API token credentials (never log these)  
- `R2_BUCKET_NAME` — bucket name  
- `R2_PUBLIC_URL` — public base URL for the bucket (no trailing slash required)

**Admin v2 HTTP**

- `POST /api/v1/admin-v2/login` — body `{ "password": "…" }` → `{ ok, token }` (light IP rate limit; passwords are never logged).
- Bearer JWT on all other admin-v2 routes: `Authorization: Bearer <token>`.
- `GET/PUT /api/v1/admin-v2/settings/theme`, `GET/PUT /api/v1/admin-v2/home-settings`
- `GET/POST/PUT/DELETE /api/v1/admin-v2/banners`, `PUT /api/v1/admin-v2/banners/reorder`
- `POST /api/v1/admin-v2/media/image` — body `{ "imageDataUrl": "data:image/jpeg;base64,...", "purpose": "banner" | "shorts" | "generic" }` → `{ ok, url }` (PNG/JPG, max ~2MB; default `purpose` is `banner`)
- `GET/POST/PUT/DELETE /api/v1/admin-v2/shorts`, `PUT /api/v1/admin-v2/shorts/reorder`
- `GET /api/v1/admin-v2/products?search=` — read-only list for the Products-lite tab

**MVP (implemented)**  

Theme editor (primary/accent/radius persisted to `adminV2Theme` + accent synced to `homeSettings.accentColor`), home headline fields, banners (CRUD, drag reorder, optional PNG/JPG upload via data URL), shorts/reels (CRUD, thumbnail URL or upload, caption, drag reorder), products-lite read-only list.

**Future hooks**  

Rich product editing, promotions tab parity with legacy admin, optional customer-app consumption of `primaryColor` / `radiusPx`, multipart uploads without base64.

### Admin APIs (token protected)

- `GET/POST/PUT/DELETE /api/v1/admin/banners` (banner objects may include optional `badge`, `link_url`)
- `GET/POST/PUT/DELETE /api/v1/admin/shorts` (optional `thumbnail_url` on shorts)
- `GET/POST/PUT/DELETE /api/v1/admin/promotions`
- `GET/PUT /api/v1/admin/home-settings`
- `GET/PUT /api/v1/admin/categories`
- `GET/PUT /api/v1/admin/products`
- `GET /api/v1/admin/orders`
- `GET /api/v1/admin/orders/:id`
- `PUT /api/v1/admin/orders/:id/status`
- `POST /api/v1/admin/orders/:id/cancel`
- `GET /api/v1/admin/orders/:id/picklist`
- `POST /api/v1/admin/orders/:id/send-to-tsd`
- `GET /api/v1/admin/orders/:id/qr`
- `GET /api/v1/orders/:orderNumber/status`
- `GET /api/v1/orders/:orderNumber/track`
- `POST /api/v1/orders/:orderNumber/feedback`
- `GET /api/v1/orders/display` (public read-only display feed)
- `POST /api/v1/integrations/datamobile/orders/:id/send`
- `POST /api/v1/integrations/dalion/orders/:id/picked`
- `GET /api/v1/courier/:token`
- `POST /api/v1/courier/:token/accept`
- `POST /api/v1/courier/:token/deliver`
- `GET /track/:orderNumber`

Order dashboard display page:

- `/orders-display` (sensor/TV operator panel, token stored in localStorage, large touch buttons)

### Home Settings CMS fields

`/api/v1/admin/home-settings` supports:

- `brandName`
- `locationText`
- `searchPlaceholder`
- `heroTitle`
- `heroSubtitle`
- `heroBadgeText`
- `bonusTitle`
- `bonusSubtitle`
- `deliveryTimeText`
- `deliveryText`
- `accentColor`
- `backgroundImageUrl`

Customer `/` home consumes these settings with fallback defaults.

After a **fresh Postgres** database (or empty catalog), run **`npm run db:seed`** once migrations have applied so categories, products, banners, shorts, and ambient tracks exist.

## Data persistence (current mode)

- Application data is persisted to `data/store.json` and loaded back on server start.
- Runtime mode is **memory + file fallback**:
  - write/update operations persist to `store.json`
  - in-memory state is active during runtime
- `uploads/products` and `uploads/categories` are served from `/uploads/...`.

### Railway note

Railway local filesystem can be ephemeral depending on deploy/runtime settings.
For production-grade persistence, attach a persistent volume or external DB/object storage.
Current `store.json` fallback is meant as a temporary persistence layer.

## Manual admin QA checklist

1. Open `/admin`, set token, ensure token save toast appears.
2. Verify token protection:
   - without `x-admin-token` => `403` on `/api/v1/admin/...`
   - valid token => `200` on admin GET endpoints.
3. Excel Import tab:
   - select `.xlsx`, run import, observe progress + summary JSON.
   - run **Yangi import qilish** and **Mavjud ma'lumotni yangilash** buttons.
4. Banners tab:
   - create banner, edit title/subtitle/image/active, toggle active, delete.
   - check `/` Home reflects active banner text.
5. Promotions tab:
   - create promo, edit title/description/discount/active, toggle active, delete.
   - check `/` Home reflects active promo text.
6. Home Settings tab:
   - save hero title/subtitle/delivery/background/accent.
   - check `/` Home and checkout delivery section reflect updates.
7. Categories tab:
   - edit displayName/icon/image URL/active.
   - upload category image file and save.
   - verify Home/Katalog category cards update.
8. Products tab:
   - search product, edit active/price/stock/category and save.
   - verify `/` and `/api/v1/products` reflect updates.
9. Restart server:
   - ensure products/categories/banners/promotions/home settings load from `data/store.json`.

## Legal note (cash agreement text)

- Checkoutdagi naqd to‘lov majburiyati matni hozircha **draft** holatda.
- Productionga chiqarishdan oldin ushbu matn yuridik (legal) tekshiruvdan o‘tishi shart.

## SMS/OTP

Adapter: `src/services/sms.service.js` (`sendSmsOtp`). Default gateway mode is **log** (no provider call). With `DEVSMS_API_KEY` / `SMS_API_KEY` and the default DevSMS URL host, mode can resolve to **devsms** even when `SMS_GATEWAY_MODE` is unset; otherwise set `SMS_GATEWAY_MODE=devsms`. Missing API key keeps **log** fallback.

### Endpoints

- `POST /api/v1/auth/request-otp` or `POST /api/v1/auth/sms/send` — body `{ "phone": "+998..." }`
- `POST /api/v1/auth/verify-otp` or `POST /api/v1/auth/sms/verify` — body `{ "phone": "+998...", "code": "..." }`
  - success: `phoneVerified=true` on profile, returns `accessToken` (JWT), `verificationToken`, and `user`.

Customer API auth: `Authorization: Bearer <accessToken>` (preferred). Legacy header `x-user-phone` still works for older clients.

Non-production (or `ALLOW_OTP_DEV_UI=true` in production): responses may include `devHint` with the OTP for UI/testing.

### Environment variables

See **Railway variables for SMS (DevSMS)** above; also `SMS_OTP_PEPPER`, `SMS_OTP_DIGITS`, `SMS_OTP_TTL_MS`, `ALLOW_OTP_DEV_UI`, `SMS_LOG_OTP_CODE`.

**Customer JWT (production):** set `CUSTOMER_SESSION_SECRET` (strong random string). Optional: `CUSTOMER_JWT_TTL_SEC` (default 30 days).

**Legal / store:** `SUPPORT_EMAIL` (default `support@globusmarket.org`). Pages: `/privacy`, `/terms`. Account deletion: `DELETE /api/v1/profile/account` (Bearer JWT).

## Android Courier App (Native Kotlin)

A professional native Android courier app project is included in `android-courier/`.

### What it includes
- Token login (manual input + QR scan)
- Secure token storage (`EncryptedSharedPreferences`)
- Active order screen (order number, address, orientir, total, item count, status)
- Accept delivery API call (`POST /api/v1/courier/:token/accept`)
- Foreground GPS tracking service with 5-second updates (`POST /api/v1/courier/:token/location`)
- Foreground notification: `Globus Market courier tracking active`
- Google Maps navigation opening
- Complete delivery API call (`POST /api/v1/courier/:token/deliver`) and tracking stop
- Clear permission/error messaging for denied location and invalid token

### Base URLs
- Current backend: `https://dalion-mobile-app-production.up.railway.app`
- Future domain (for easy switch): `https://globusmarket.org`

### Customer app — Capacitor (iOS / Android, dizayn buzilmaydi)

Mijoz ilovasi vebdagi `index.html` dan yuklanadi (nusxa emas). Reja: `docs/MOBILE-SAFE-PLAN.md`, tekshiruv: `docs/MOBILE-TEST-CHECKLIST.md`.

```bash
npm install
set CAPACITOR_SERVER_URL=https://dalion-mobile-app-production.up.railway.app
npm run cap:add:android
npm run cap:sync
npm run cap:open:android
```

`index.html` / `styles.css` o‘zgartirilmaydi. iOS: macOS + `npm run cap:add:ios`.

**Bosqich 2 (Payme):** native ilovada Payme in-app browser orqali ochiladi; brauzerda avvalgidek `window.location`. Pluginlar: `npm install` → `CAPACITOR_SERVER_URL` o‘rnating → `npm run cap:sync`.

### Build APK locally (courier native)
1. Install Android Studio (latest stable).
2. Open folder: `android-courier/`.
3. Let Gradle sync complete.
4. Build debug APK:
   - Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
   - or terminal:
     ```bash
     cd android-courier
     ./gradlew assembleDebug
     ```
5. APK output:
   `android-courier/app/build/outputs/apk/debug/app-debug.apk`

> Note: In this environment, Android SDK/Gradle wrapper may not be available to produce APK directly.
