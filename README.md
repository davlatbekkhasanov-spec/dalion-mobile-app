# DALION Mobile App (Preview + API)

## Admin-protected Excel XLSX import

## Payme Merchant API endpoint

- `GET /api/payme` returns health JSON for browser checks.
- `POST /api/payme` accepts Payme JSON-RPC (Merchant API) with `account.order_id`.
- Implemented methods:
  - `CheckPerformTransaction`
  - `CreateTransaction`
  - `PerformTransaction`
  - `CancelTransaction`
  - `CheckTransaction`

### Railway variables for Payme auth

Add these variables in Railway **Variables** section:

- `PAYME_MERCHANT_ID`
- `PAYME_TEST_KEY`
- `PAYME_SECRET_KEY`

### Railway variables for SMS (DevSMS)

- `SMS_GATEWAY_MODE` or `SMS_PROVIDER`: set to `devsms` for [DevSMS](https://devsms.uz/api/docs.php). Without `DEVSMS_API_KEY` / `SMS_API_KEY`, the server falls back to **log** mode (no outbound SMS).
- **Auto DevSMS (Railway-friendly):** if `SMS_GATEWAY_MODE` / `SMS_PROVIDER` are **unset**, `SMS_API_URL` is unset, and `DEVSMS_API_KEY` or `SMS_API_KEY` is set while `DEVSMS_API_URL` is the default (or another `*.devsms.uz` host), the gateway mode resolves to **devsms** automatically — no separate mode variable required.
- `DEVSMS_API_KEY` (or generic `SMS_API_KEY`): API token; sent per `DEVSMS_AUTH_MODE` (below).
- `DEVSMS_AUTH_MODE` (default `bearer`): `bearer` — `Authorization: Bearer …` only; `body` — include `api_key` in the JSON body only; `both` — header and body (for providers that expect both).
- `DEVSMS_SENDER_FROM`: sender ID (optional; default `4546` per provider docs).
- `DEVSMS_CALLBACK_URL`: optional delivery-status webhook URL (only if you consume callbacks).
- Optional: `DEVSMS_API_URL` (default `https://devsms.uz/api/send_sms.php`), `DEVSMS_OTP_MESSAGE_TEMPLATE` / `SMS_MESSAGE_TEMPLATE` with `{{code}}`, `DEVSMS_SMS_TYPE` (e.g. `universal_otp`), `DEVSMS_SERVICE_NAME`, `DEVSMS_OTP_TEMPLATE_TYPE` (1–4, for universal OTP), `SMS_LOG_OTP_CODE=true` to log plaintext OTP (avoid in production).

`POST /api/payme` now requires Basic authorization in test mode using `PAYME_MERCHANT_ID:PAYME_TEST_KEY`.
If credentials are missing, the endpoint returns configuration error until variables are set.

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

### Admin APIs (token protected)

- `GET/POST/PUT/DELETE /api/v1/admin/banners`
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
  - success: `phoneVerified=true` on profile, returns `verificationToken` and `user`.

Non-production (or `ALLOW_OTP_DEV_UI=true` in production): responses may include `devHint` with the OTP for UI/testing.

### Environment variables

See **Railway variables for SMS (DevSMS)** above; also `SMS_OTP_PEPPER`, `SMS_OTP_DIGITS`, `SMS_OTP_TTL_MS`, `ALLOW_OTP_DEV_UI`, `SMS_LOG_OTP_CODE`.

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

### Build APK locally
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
