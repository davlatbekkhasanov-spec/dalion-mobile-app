# Production Deployment Guide

## Required environment variables
- PORT (default 3000)
- DATABASE_URL
- PAYME_MERCHANT_ID
- PAYME_SECRET_KEY
- DALION_API_URL
- DALION_USERNAME
- DALION_PASSWORD
- CORS_ALLOWED_ORIGINS (comma-separated, e.g. https://app.example.com,http://localhost:3000)

## Start
```bash
npm start
```

## Railway
1. Connect repository to Railway.
2. Set all env vars in Railway Variables panel.
3. Deploy and verify `/health` and `/api/v1/home`.

## VPS + PM2
```bash
npm ci
pm2 start index.js --name dalion-backend
pm2 save
pm2 startup
```

## Post-deploy checks
- `GET /health`
- `GET /api/v1/products`
- Create test order via `/api/v1/orders`
- Verify Payme RPC endpoint `/api/payme`

## Security notes
- Never commit `.env`.
- Do not log DALION or payment secrets.
