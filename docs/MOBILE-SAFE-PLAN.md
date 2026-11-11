# GlobusMarket — mobil ilova (xavfsiz rejada)

**Maqsad:** iOS va Android ilovasi, **mavjud dizayn va veb ishlashini buzmasdan**.

## Asosiy qoida

| Fayl / qism | Tezish mumkinmi? |
|-------------|------------------|
| `index.html`, `styles.css` | Ehtiyot bilan (veb + native bir UI) |
| `index.js` (mijoz API) | Faqat **yangi** endpoint, eskisi qoladi |
| `admin.html` | Ops UI — native mijozga kirmaydi |
| `mobile-www/`, `capacitor.config.js` | **Ha** (qobiq) |
| `android/`, `ios/` | **Ha** (Capacitor native) |
| Kuryer / tablo | Alohida dasturlar (ixtiyoriy) |

## Bosqichlar

### Bosqich 1 — Capacitor qobiq ✅

- `capacitor.config.js` + `mobile-www/`
- Default production: `https://globusmarket.org`
- `android/` va `ios/` loyihalar repoda

### Bosqich 2 — Payme ✅

- `@capacitor/browser` + `@capacitor/app`
- `public/mobile-native-bridge.js`

### Bosqich 3 — JWT sessiya ✅

- `src/customer-session.js`
- Production: `CUSTOMER_SESSION_SECRET`

### Bosqich 4 — Store hujjatlar ✅

- `/privacy`, `/terms`
- Hisob o‘chirish
- `docs/STORE-PUBLISH.md`

## Buyruqlar

```bash
npm install
npm run cap:sync:prod
npm run cap:open:android
npm run cap:open:ios   # macOS
```

## Tekshiruv

`docs/MOBILE-TEST-CHECKLIST.md` · `docs/STORE-PUBLISH.md`
