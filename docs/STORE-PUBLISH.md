# GlobusMarket — App Store / Play Market chiqarish

## Texnik holat (shu PR dan keyin)

| Band | Holat |
|------|--------|
| Capacitor `android/` loyihasi | ✅ |
| Capacitor `ios/` loyihasi | ✅ (macOS + CocoaPods + Xcode kerak) |
| `appId` / bundle | `org.globusmarket.app` |
| Production URL | `https://globusmarket.org` (`capacitor.config.js`) |
| Privacy / Terms | `/privacy`, `/terms` |
| Hisob o‘chirish | Profil → Hisobni o‘chirish |
| Payme native browser | `@capacitor/browser` |
| Status bar / splash | pluginlar + ikonka generator |
| Kamera / joylashuv ruxsat matnlari | AndroidManifest + Info.plist |

## Lokal build

```bash
npm install
npm run cap:sync:prod
npm run cap:open:android   # Android Studio → Build → Generate Signed Bundle / APK
npm run cap:open:ios       # faqat macOS: pod install, Xcode Archive
```

Play uchun tavsiya: **AAB** (`bundleRelease`), App Store: **Archive → Distribute**.

## Store listing (siz to‘ldirasiz)

### Google Play
- Developer akkaunt
- Ilova nomi, qisqa/uzun tavsif (UZ/RU)
- Screenshotlar (telefon + ixtiyoriy planshet)
- Feature graphic 1024×500
- Content rating questionnaire
- Privacy policy URL: `https://globusmarket.org/privacy`
- Data safety form (SMS, manzil, ixtiyoriy selfie/GPS, to‘lov)
- Target audience / ads declaration

### Apple App Store
- Apple Developer Program
- Screenshots (6.7" / 6.1" majburiy o‘lchamlar)
- Privacy Nutrition Labels
- Support URL + Marketing URL
- Age rating
- Review notes: test telefon + OTP qanday olinadi

## Apple 4.2 (muhim)

Ilova production vebni WebView orqali ochadi. Apple ba’zan **4.2 Minimum Functionality** bilan rad qiladi.

Yengillatish (allaqachon qo‘shilgan):
- Native splash / status bar
- In-app Payme browser
- Deep link (`https://globusmarket.org`, `globusmarket://`)
- Hisob o‘chirish, privacy/terms

Agar rad bo‘lsa: Review Notes da “native payment browser, order tracking, account deletion, SMS auth” ni yozing; keyingi bosqichda offline katalog yoki push qo‘shish mumkin.

## Imzolash

- Android: upload keystore (o‘zingiz yarating, hech kimga bermang)
- iOS: Distribution certificate + App Store provisioning profile

Bu repoda **secret key / keystore yo‘q** — ataylab.

## Chiqarishdan oldin checklist

- [ ] `npm run cap:sync:prod`
- [ ] Real Android telefonida: login, savat, buyurtma, Payme, track, hisob o‘chirish
- [ ] Real iPhone da xuddi shu
- [ ] SMS OTP productionda ishlaydi
- [ ] `SUPPORT_EMAIL` Railway da to‘g‘ri
- [ ] Privacy/Terms matni yuridik ko‘rib chiqilgan
- [ ] Play Console / App Store Connect listing to‘ldirilgan
- [ ] Imzolangan AAB / IPA yuklangan
