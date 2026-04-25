# DALION Mobile App (Preview + API)

## Admin-protected Excel XLSX import

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
