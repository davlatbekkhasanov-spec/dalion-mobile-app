# GlobusMarket — mobil ilova (xavfsiz rejada)

**Maqsad:** iOS va Android ilovasi, **mavjud dizayn va veb ishlashini buzmasdan**.

## Asosiy qoida

| Fayl / qism | Tezish mumkinmi? |
|-------------|------------------|
| `index.html`, `styles.css` | **Yo‘q** (1–2-bosqichda) |
| `index.js` (mijoz API) | Faqat **yangi** endpoint, eskisi qoladi |
| `admin.html`, `orders.html`, `courier.html` | **Yo‘q** |
| `mobile-www/`, `capacitor.config.js` | **Ha** (faqat qobiq) |
| `android/`, `ios/` (Capacitor) | **Ha** (alohida papka) |
| `android-courier/` | Alohida loyiha, keyinroq |

## Bosqichlar

### Bosqich 0 — hujjat (hozir)

- Ushbu reja + `MOBILE-TEST-CHECKLIST.md`
- **Kodga tegilmaydi**

### Bosqich 1 — Capacitor qobiq (hozir)

- `capacitor.config.js` + `mobile-www/` (faqat yo‘riqnoma sahifa)
- `CAPACITOR_SERVER_URL` o‘rnatilganda ilova **production veb**ni yuklaydi — `index.html` nusxalanmaydi
- Veb `/` brauzerda **o‘zgarmaydi**

### Bosqich 2 — Payme (keyin, rozilikdan keyin)

- `@capacitor/browser` yoki in-app browser
- Minimal patch `index.html` (faqat to‘lov URL ochilishi)
- Eski `window.location` yo‘li feature-flag bilan qoladi

### Bosqich 3 — JWT (keyin)

- Backend: session token
- `x-user-phone` vaqtincha qo‘llab-quvvatlanadi (orqaga moslik)

### Bosqich 4 — Store

- Privacy Policy, icon, screenshot, account delete

## Capacitor: ishga tushirish

```bash
npm install
# Production (tavsiya — dizayn serverdagi index.html dan keladi):
set CAPACITOR_SERVER_URL=https://YOUR-RAILWAY-DOMAIN.up.railway.app
npm run cap:sync

# Android (Windows/Mac):
npm run cap:open:android

# iOS (faqat macOS + Xcode):
npm run cap:open:ios
```

Lokal server bilan sinov (telefon/emulyator kompyuterga ulanishi kerak):

```bash
set CAPACITOR_SERVER_URL=http://10.0.2.2:3000
npm run cap:sync
```

## Orqaga qaytish

- Capacitor olib tashlash: `android/`, `ios/`, `mobile-www/`, `capacitor.config.js` ni o‘chirish — veb ta’sir qilmaydi
- `CAPACITOR_SERVER_URL` bo‘lmasa — native ilova faqat sozlash ekranini ko‘rsatadi, server buzilmaydi

## Tekshiruv

Har bosqichdan keyin: `docs/MOBILE-TEST-CHECKLIST.md`
