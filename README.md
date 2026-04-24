# DALION Mobile App (Preview + API)

## Admin-protected Excel XLSX import

Endpoint:

`POST /api/v1/integrations/excel/import/products-xlsx`

This endpoint is protected with admin token header.

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
