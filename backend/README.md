# Backend data source notes

## Product source strategy
- **Current temporary source:** Excel import (`source: "excel"`).
- **Future main source:** DALION Trend sync (`source: "dalion"`).
- No fake/demo DALION data should be introduced in backend services.

## DALION environment variables
- `DALION_ENABLED` — must be `"true"` to enable sync endpoints.
- `DALION_API_URL`
- `DALION_USERNAME`
- `DALION_PASSWORD`

If DALION is not configured, app startup should still work and DALION sync endpoints should return a safe configuration error.
