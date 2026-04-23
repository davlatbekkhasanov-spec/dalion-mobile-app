# Backend Structure (Mobile API)

The backend serves the mobile app, Telegram bot, and admin panel.

## Proposed Folder Structure

```text
backend/
  src/
    modules/
      auth/
      products/
      categories/
      search/
      cart/
      orders/
      payments/
      delivery/
      users/
      dalion/
      telegram/
    routes/
    controllers/
    services/
    repositories/
    config/
    utils/
```

## Mobile API Base URL

`/api/v1`

## Key Endpoints

- `GET /home`
- `GET /categories`
- `GET /products`
- `GET /products/:id`
- `GET /search`
- `POST /delivery/calc`
- `POST /cart/validate`
- `POST /orders`
- `GET /orders/:id`
- `GET /me/orders`
- `POST /payments/proof`

## Important Rules

- DALION is only a data source.
- Backend is the main logic layer.
- Telegram bot uses the same order system.
- Admin panel uses the same order system.
