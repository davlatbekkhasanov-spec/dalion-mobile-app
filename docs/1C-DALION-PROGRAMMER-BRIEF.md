# GlobusMarket ↔ 1C Dalion Trend — dasturchi brifi

**Sana:** 2026-10-05  
**Backend (production):** `https://dalion-mobile-app-production.up.railway.app`  
**Asosiy domen:** `https://globusmarket.org`

Bu hujjat **1C Dalion Trend** dasturchisiga beriladi. Unda: nima allaqachon tayyor, nima hali stub, va 1C tomonda qanday HTTP chaqiriq / kod kerak.

---

## 1. Hozirgi tayyorlik (qisqa xulosa)

| Yo‘nalish | Holat | Izoh |
|-----------|--------|------|
| Buyurtma yig‘ilgach GlobusMarket ga xabar (`order-picked`) | **Tayyor (webhook)** | Secret + `ONEC_ORDERS_ENABLED=true` kerak |
| Admin orqali “picked” ni qo‘lda sinash | **Tayyor** | `/integrations/dalion/orders/:id/picked` |
| Yangi buyurtmani 1C ga avtomatik yuborish | **Stub** | HTTP klient hali yo‘q — 1C API kontrakti kerak |
| Mahsulot / narx / qoldiq live sync | **Tayyor emas** | Hozir asosan **Excel import** |
| TSD (Data Mobile) live | **Stub** | Alohida TSD jamoasi |

**Xulosa:** GlobusMarket **qabul qiluvchi** tomon (1C → biz) pick-complete uchun tayyor. **Yuboruvchi** tomon (biz → 1C, yangi buyurtma) hali stub — buning uchun 1C dasturchidan **HTTP endpoint + autentifikatsiya + JSON schema** kerak.

---

## 2. Buyurtma hayoti (integratsiya nuqtasi)

```
Mijoz buyurtma beradi (GlobusMarket)
        ↓
Admin / TSD: status → preparing (yig‘ish)
        ↓
1C / ombor: tovarlar yig‘ib bo‘lindi
        ↓
1C → POST .../integrations/onec/order-picked   ★ SHU YERDA 1C KOD YOZADI
        ↓
GlobusMarket status → ready_for_courier (yoki preparing)
```

---

## 3. 1C dan GlobusMarket ga: “yig‘ish tugadi” webhook

### 3.1 Endpoint

```http
POST https://globusmarket.org/api/v1/integrations/onec/order-picked
Content-Type: application/json
x-integration-secret: <ONEC_WEBHOOK_SECRET>
```

(Alternativ header nomi ham qabul qilinadi: `x-webhook-secret`.)

Railway da yoqilishi kerak:

- `ONEC_ORDERS_ENABLED=true`
- `ONEC_WEBHOOK_SECRET=<uzun random string>`
- ixtiyoriy: `ONEC_PICK_TARGET_STATUS=ready_for_courier` (default) yoki `preparing`

### 3.2 Request body (JSON)

Kamida **bitta** identifikator: `orderId` **yoki** `orderNumber`.

```json
{
  "orderId": "clxxxxxxxxxxxxxxxxxxxx",
  "orderNumber": "100042",
  "onecDocumentId": "ДЛН-00001234",
  "pickedAt": "2026-10-05T14:30:00.000Z"
}
```

| Maydon | Majburiy | Tavsif |
|--------|----------|--------|
| `orderId` | shartli* | GlobusMarket ichki ID (`cuid`) |
| `orderNumber` | shartli* | Mijozga ko‘rinadigan raqam (`100042`) — 1C uchun qulayroq |
| `onecDocumentId` | yo‘q | 1C hujjat raqami / GUID |
| `pickedAt` | yo‘q | ISO-8601 vaqt; bo‘lmasa server vaqti yoziladi |

\* `orderId` yoki `orderNumber` dan **bittasi** bo‘lishi shart.

### 3.3 Muvaffaqiyatli javob

```json
{
  "ok": true,
  "order": { "...": "yangilangan buyurtma obyekti" }
}
```

### 3.4 Xatoliklar

| HTTP | Sabab |
|------|--------|
| 401 | Secret noto‘g‘ri / yo‘q |
| 404 | Buyurtma topilmadi |
| 503 | `ONEC_ORDERS_ENABLED` o‘chirilgan |
| 400 | Body bo‘sh / id yo‘q |

### 3.5 1C (HTTP) misol — konseptual

1C da `HTTPСоединение` / `HTTPЗапрос` orqali:

1. JSON yig‘ish: `orderNumber`, `onecDocumentId`, `pickedAt`
2. Header: `x-integration-secret`
3. `POST` yuqoridagi URL ga
4. Javobda `ok = true` ekanini tekshirish
5. Xato bo‘lsa — qayta urinish (idempotent: qayta chaqirish xavfsiz, status allaqachon `ready_for_courier` bo‘lsa ham qayta yoziladi)

> **Muhim:** 1C dasturchi odatda `orderNumber` ni saqlashi kifoya (mijoz cheki / trekingdagi raqam). `orderId` majburiy emas.

---

## 4. GlobusMarket dan 1C ga: yangi buyurtma eksporti (HALI STUB)

Hozir `exportOrderTo1C` faqat log + `1c-stub-...` id yozadi. **Live ulash uchun 1C dasturchidan quyidagilar kerak:**

### 4.1 1C taqdim etishi kerak bo‘lgan narsa

1. **HTTP endpoint** (masalan):  
   `POST https://<1c-host>/hs/globusmarket/orders`  
   yoki HTTP-servis / OData / nashr qilingan URL
2. **Autentifikatsiya:** Basic login/parol **yoki** Bearer token **yoki** API key header
3. **JSON schema** (qabul qiladigan maydonlar ro‘yxati)
4. **Muvaffaqiyat/xato javobi** formati (`200` + body)
5. Test (staging) URL va credential

### 4.2 GlobusMarket yuboradigan buyurtma maydonlari (taklif etilgan kontrakt)

1C shu strukturani qabul qilishi kerak (yoki o‘z mappingini aytishi kerak):

```json
{
  "orderId": "clxxxxxxxx",
  "orderNumber": "100042",
  "createdAt": "2026-10-05T12:00:00.000Z",
  "status": "preparing",
  "customer": {
    "name": "Davlatbek Xasanov",
    "phone": "+998972234336"
  },
  "delivery": {
    "address": "Samarqand, ...",
    "landmark": "",
    "lat": 39.65,
    "lng": 66.96,
    "price": 15000,
    "eta": "30 daqiqa"
  },
  "payment": {
    "method": "cash",
    "status": "pending"
  },
  "totals": {
    "subtotal": 120000,
    "deliveryPrice": 15000,
    "total": 135000,
    "currency": "UZS"
  },
  "items": [
    {
      "productId": "clprod...",
      "barcode": "4780001234567",
      "name": "Mahsulot nomi",
      "quantity": 2,
      "price": 25000,
      "lineTotal": 50000
    }
  ]
}
```

**Eslatma (hozirgi DB):**

- `OrderItem` da: `productId`, `productName`, `quantity`, `price`
- Mahsulotda `barcode` bor (Excel/Dalion import orqali) — eksportga **qo‘shib berish** mumkin; 1C odatda **shtrixkod / artikul** bo‘yicha bog‘laydi
- Summalar **butun so‘m** (tiyin emas)

### 4.3 1C dan kutilyotgan javob (taklif)

```json
{
  "ok": true,
  "onecDocumentId": "ДЛН-00001234",
  "message": "Документ создан"
}
```

Shu `onecDocumentId` keyin `order-picked` webhook da qaytariladi.

---

## 5. Mahsulot katalogi

| Usul | Holat |
|------|--------|
| Excel import (`/api/v1/integrations/excel/import/products-xlsx`) | **Ishlaydi** (admin token) |
| Live `DALION_API_URL` + login/parol sync | **Hali yo‘q** (`DALION_NOT_CONFIGURED`) |

Agar 1C live katalog sync xohlasa, alohida: mahsulotlar/qoldiq/narx HTTP API (yoki fayl almashinuvi jadvali) kerak.

---

## 6. 1C dasturchidan so‘raladigan checklist

Iltimos, 1C tomonda quyidagilarni yozib / berib yuboring:

1. [ ] `order-picked` ni chaqirishga tayyormisiz? (URL + secret biz beramiz)
2. [ ] Buyurtmani qaysi maydon bilan bog‘laysiz: `orderNumber` yoki `orderId`?
3. [ ] Yangi buyurtmani 1C ga qabul qilish uchun **HTTP URL** qanday?
4. [ ] Auth qanday (Basic / Bearer / API key)? Test login?
5. [ ] Mahsulotni nima bilan topasiz: `barcode`, `article`, `code`?
6. [ ] Yig‘ish tugashi qachon: TSD dan keyinmi, 1C hujjat “Проведен” bo‘lgachmi?
7. [ ] Staging (test) bazami yoki to‘g‘ridan-to‘g‘ri productionmi?

---

## 7. Biz (GlobusMarket) beradigan narsalar

1. Production base URL  
2. `ONEC_WEBHOOK_SECRET` (bir marta, xavfsiz kanal orqali)  
3. Test buyurtma `orderNumber`  
4. Curl misoli:

```bash
curl -X POST "https://globusmarket.org/api/v1/integrations/onec/order-picked" \
  -H "Content-Type: application/json" \
  -H "x-integration-secret: YOUR_SECRET" \
  -d '{
    "orderNumber": "100042",
    "onecDocumentId": "TEST-001",
    "pickedAt": "2026-10-05T14:30:00.000Z"
  }'
```

---

## 8. Admin qo‘lda test (secretsiz, faqat admin token)

```http
POST /api/v1/integrations/dalion/orders/:id/picked
x-admin-token: <ADMIN_IMPORT_TOKEN>
Content-Type: application/json

{ "orderId": "...", "onecDocumentId": "MANUAL-TEST" }
```

Bu endpoint `ONEC_ORDERS_ENABLED` ni talab qilmaydi — ichki sinov uchun.

---

## 9. Xulosa 1C dasturchiga

**Hozir yozishingiz kerak bo‘lgan kod (1-bosqich):**  
Yig‘ish tugaganda GlobusMarket ga `POST /api/v1/integrations/onec/order-picked` yuborish (JSON + `x-integration-secret`).

**Keyingi bosqich (birgalikda):**  
GlobusMarket → 1C buyurtma yaratish HTTP servisi (URL, auth, JSON schema siz berasiz — biz `exportOrderTo1C` ni live qilamiz).
