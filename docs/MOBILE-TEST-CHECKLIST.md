# Mobil bosqich — tekshiruv ro‘yxati

Har bosqichdan keyin belgilang. Keyingi bosqichga o‘tish — faqat **veb OK** + (mobil bo‘lsa) **mobil OK**.

## Veb (har doim — `/` brauzerda)

- [ ] Bosh sahifa ochiladi, katalog yuklanadi
- [ ] Qidiruv / kategoriya ishlaydi
- [ ] Savatga qo‘shish / o‘zgartirish
- [ ] SMS OTP login
- [ ] Buyurtma berish (naqd yoki Payme)
- [ ] `/track/:orderNumber` tracking
- [ ] Admin `/admin` — token, buyurtmalar
- [ ] Tablo `/orders-display` yangilanadi
- [ ] Kuryer `/courier/:token` accept / location

## Bosqich 1 — Capacitor qobiq

- [ ] `npm test` — barcha testlar o‘tadi
- [ ] `CAPACITOR_SERVER_URL` bilan `npm run cap:sync` xatosiz
- [ ] Android/iOS: ilova ochiladi, **xuddi vebdagi** dizayn
- [ ] Scroll, safe area (notch), pastki panel
- [ ] `CAPACITOR_SERVER_URL` o‘chirilgan build — sozlash ekrani (server buzilmagan)

## Bosqich 2 — Payme (keyin)

- [ ] Payme to‘lov ochiladi
- [ ] To‘lovdan keyin ilovaga qaytish
- [ ] Vebda Payme hali ishlaydi

## Bosqich 3 — JWT (keyin)

- [ ] Eski mijozlar (x-user-phone) ishlaydi
- [ ] Yangi token bilan login

---

**Izoh:** Bosqich 1 da `index.html` o‘zgartirilmaydi — mobil production URL dan yuklanadi.
