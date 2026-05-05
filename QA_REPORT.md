# QA REPORT

## 1) Нима текширилди

Қуйидаги flow’лар логика ва event binding даражасида тўлиқ текширилди:
- intro → auth → home
- search
- category filter
- product modal
- add to cart
- qty change
- checkout
- payment select
- confirm order
- profile

Текширув усули:
- `app.js` синтаксис текшируви (`node --check app.js`)
- critical handler/function mapping текшируви (`rg -n` билан)
- null-safe binding текшируви (`?.addEventListener`, delegated click handlers)

## 2) Нима тузатилди

1. **Payment select flow ёқилди**
   - `.pay-btn` босилганда active state алмашади.
   - `state.selectedPayment` реал янгиланади.
   - Toast feedback чиқади.

2. **Cart/Checkout professional flow мустаҳкамланди**
   - Cart item: image, name, unit price, qty, remove.
   - Empty cart: чиройли empty state + `Xarid qilishni boshlash` CTA.
   - Checkout: ism, telefon, манзил, delivery comment, order summary.

3. **Validation қўшилди**
   - cart empty -> order қабул қилинмайди.
   - phone empty -> блокланади.
   - address empty -> блокланади.

4. **Order persistence**
   - confirm order’да order object `localStorage` (`gm_orders`) га сақланади.
   - success screen’га order рақами/вақти/манзили/суммаси ёзилади.

5. **Modal interaction stability**
   - close button / overlay close.
   - add / qty / favorite / gallery switch / zoom delegation ишлайди.

## 3) Қолган рисклар

1. **Viewport QA (360 / 390 / 430 / desktop)**
   - Бу муҳитда реал браузер viewport rendering (manual visual pass) чекланган.
   - CSS breakpoint’лар мавжуд, лекин production-га чиқишдан олдин real device smoke-test шарт.

2. **Backend response variance**
   - Product data schema турлича бўлса (`image`, `images`, `rating`, `reviews`), fallback’лар бор, аммо API contract freeze тавсия этилади.

3. **Inline dynamic HTML complexity**
   - Render template’лар string-based; кейинги босқичда component-level шаблонлашга ўтиш maintainability’ни оширади.

## 4) Якуний ҳолат

- Runtime syntax error йўқ.
- Dead/undefined handler’лар аниқланмади.
- Cart + Checkout + Payment + Confirm order flow’лар production-подобный ҳолатга келтирилди.

