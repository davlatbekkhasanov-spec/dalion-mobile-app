(() => {
const $=id=>document.getElementById(id);
const els={phone:$('phone'),openRegisterBtn:$('openRegisterBtn'),authSheetOverlay:$('authSheetOverlay'),closeAuthSheetBtn:$('closeAuthSheetBtn'),submitAuthBtn:$('submitAuthBtn'),authName:$('authName'),authPhone:$('authPhone'),searchInput:$('searchInput'),searchClearBtn:$('searchClearBtn'),openSearchBtn:$('openSearchBtn'),homeAllCategoriesLink:$('homeAllCategoriesLink'),homeMoreProductsLink:$('homeMoreProductsLink'),homeProducts:$('homeProducts'),homeDiscountProducts:$('homeDiscountProducts'),homeFastProducts:$('homeFastProducts'),homeBestSellerProducts:$('homeBestSellerProducts'),homeReorderProducts:$('homeReorderProducts'),homeCategories:$('homeCategories'),categoryResults:$('categoryResults'),searchResults:$('searchResults'),bannerCarousel:$('bannerCarousel'),promoCarousel:$('promoCarousel'),cartItems:$('cartItems'),cartEmpty:$('cartEmpty'),cartSummary:$('cartSummary'),cartSubtotal:$('cartSubtotal'),cartDelivery:$('cartDelivery'),cartTotalPrice:$('cartTotalPrice'),cartBadge:$('cartBadge'),homeCartShortcutBadge:$('homeCartShortcutBadge'),homeCartShortcut:$('homeCartShortcut'),cartEmptyCta:$('cartEmptyCta'),orderBtn:$('orderBtn'),checkoutItems:$('checkoutItems'),checkoutSubtotal:$('checkoutSubtotal'),checkoutDeliveryPrice:$('checkoutDeliveryPrice'),checkoutGrandTotal:$('checkoutGrandTotal'),checkoutTotal:$('checkoutTotal'),manualAddress:$('manualAddress'),checkoutSavedAddress:$('checkoutSavedAddress'),checkoutAddressLabel:$('checkoutAddressLabel'),confirmOrderBtn:$('confirmOrderBtn'),backHomeBtn:$('backHomeBtn'),profileName:$('profileName'),profilePhone:$('profilePhone'),profileAddress:$('profileAddress'),profileOrders:$('profileOrders'),bottomNav:$('bottomNav'),toast:$('toast')};
const state={products:[],categories:[],cart:{},favorites:{},selectedCategory:'all',searchQuery:'',selectedPayment:'cash',user:null,deliveryAddress:'',currentView:'homeView'};
const STORAGE={cart:'gm_cart',favorites:'gm_favorites',user:'globusUser'}; const views=['homeView','searchView','cartView','checkoutView','successView','profileView'];
const money=v=>`${Number(v||0).toLocaleString('ru-RU')} so'm`;const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const save=()=>{localStorage.setItem(STORAGE.cart,JSON.stringify(state.cart));localStorage.setItem(STORAGE.favorites,JSON.stringify(state.favorites));if(state.user)localStorage.setItem(STORAGE.user,JSON.stringify(state.user));};
const load=()=>{state.cart=JSON.parse(localStorage.getItem(STORAGE.cart)||'{}');state.favorites=JSON.parse(localStorage.getItem(STORAGE.favorites)||'{}');state.user=JSON.parse(localStorage.getItem(STORAGE.user)||'null');state.deliveryAddress=state.user?.address||'';};
const showToast=t=>{if(!els.toast)return;els.toast.textContent=t;els.toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>els.toast.classList.remove('show'),1200)};
async function api(path){try{const r=await fetch(`/api/v1${path}`);return await r.json()}catch{return {}}}
async function initData(){const d=await api('/products?page=1&limit=200');state.products=(d.items||d.products||[]).map(p=>({...p,id:Number(p.id),price:Number(p.price||0),oldPrice:Number(p.oldPrice||0),stock:Number(p.stock??0),category:p.category||'Boshqa',name:p.name||'Mahsulot'}));state.categories=['all',...Array.from(new Set(state.products.map(p=>p.category)))];}
const filtered=()=>state.products.filter(p=>(state.selectedCategory==='all'||p.category===state.selectedCategory)&&(!state.searchQuery||p.name.toLowerCase().includes(state.searchQuery.toLowerCase())));
function calculateTotals(){let subtotal=0,qty=0;Object.entries(state.cart).forEach(([id,q])=>{const p=state.products.find(x=>x.id===+id);if(!p)return;qty+=+q;subtotal+=+q*p.price});const delivery=qty?12000:0;return{subtotal,delivery,total:subtotal+delivery,qty}}
function addToCart(id){const p=state.products.find(x=>x.id===+id);if(!p||p.stock===0)return showToast('Сотувда йўқ');state.cart[p.id]=(state.cart[p.id]||0)+1;save();renderAll();updateBadges();showToast('Savatga qo‘shildi');els.cartBadge?.classList.add('pop');els.homeCartShortcutBadge?.classList.add('pop');setTimeout(()=>{els.cartBadge?.classList.remove('pop');els.homeCartShortcutBadge?.classList.remove('pop')},260)}
function removeFromCart(id){delete state.cart[id];save();renderAll()} function increaseQty(id){addToCart(id)} function decreaseQty(id){if(!state.cart[id])return;state.cart[id]-=1;if(state.cart[id]<=0)delete state.cart[id];save();renderAll()}
function card(p){const q=state.cart[p.id]||0,out=p.stock===0,fav=!!state.favorites[p.id];const discount=p.oldPrice>p.price?Math.round((1-p.price/p.oldPrice)*100):0;
return `<article class="product" data-open-product="${p.id}"><div class="image-box">${p.image?`<img src="${safe(p.image)}" alt="${safe(p.name)}">`:`<div class="image-fallback"><i>🛍️</i><span>Rasm mavjud emas</span><small>${safe(p.category||'Mahsulot')}</small></div>`}<div class="product-top-row">${discount?`<span class="discount-chip">-${discount}%</span>`:'<span></span>'}<button class="fav-btn" data-action="fav" data-id="${p.id}">${fav?'❤':'♡'}</button></div></div><div class="product-info"><h5>${safe(p.name)}</h5><p class="product-rating">⭐ ${Number(p.rating||4.7).toFixed(1)} • ${Math.max(12,Number(p.reviews||36))} baho</p><p class="price">${money(p.price)}</p>${p.oldPrice>p.price?`<p class="old-price">${money(p.oldPrice)}</p>`:'<p class="old-price"></p>'}<div class="credit-badge">Muddatli to‘lov mavjud</div><p class="meta">${out?'🔴 Сотувда йўқ':'🟢 Omborda bor'}</p>${out?`<button class="quick-add-btn" disabled>Сотувда йўқ</button>`:q?`<div class="qty"><button data-action="dec" data-id="${p.id}">−</button><span>${q}</span><button data-action="inc" data-id="${p.id}">+</button></div>`:`<button class="quick-add-btn" data-action="add" data-id="${p.id}">Tez qo‘shish</button>`}</div></article>`}
function openProductModal(id){
const p=state.products.find(x=>x.id===+id);if(!p)return;const ov=$("productModalOverlay");if(!ov)return;
const gallery=[p.image,...(Array.isArray(p.images)?p.images:[])].filter(Boolean);
const discount=p.oldPrice>p.price?Math.round((1-p.price/p.oldPrice)*100):0;
$("modalName")&&($("modalName").textContent=p.name);
$("modalCategory")&&($("modalCategory").textContent=`Kategoriya: ${p.category||'-'}`);
$("modalPrice")&&($("modalPrice").textContent=money(p.price));
$("modalOldPrice")&&($("modalOldPrice").textContent=p.oldPrice>p.price?`${money(p.oldPrice)}  •  -${discount}%`:'' );
$("modalStickyPrice")&&($("modalStickyPrice").textContent=money(p.price));
$("modalDescription")&&($("modalDescription").textContent=p.description||'Premium sifatli mahsulot. Tez yetkazib beriladi.');
$("modalEta")&&($("modalEta").textContent='🚚 20-40 daqiqa ichida yetkazish');
$("modalAvailability")&&($("modalAvailability").textContent=(p.stock>0?'Mavjud':'Sotuvda yo‘q'));
$("modalTrustDelivery")&&($("modalTrustDelivery").textContent='💳 Muddatli to‘lov • 🔒 Xavfsiz to‘lov • ✅ Original mahsulot');
const box=document.querySelector('.modal-image');
if(box){
  const main=gallery[0];
  const thumbs=gallery.slice(0,4).map((src,i)=>`<button class="modal-thumb ${i===0?'active':''}" data-action="switch-image" data-src="${safe(src)}"><img src="${safe(src)}" alt="thumb"></button>`).join('');
  box.innerHTML=`<div class="modal-gallery"><img class="modal-main-img" data-action="zoom-image" src="${safe(main||'')}" alt="${safe(p.name)}"><div class="modal-thumbs">${thumbs}</div></div>`;
}
const rating=Number(p.rating||4.7).toFixed(1);const reviews=Math.max(12,Number(p.reviews||36));
const specs=$("modalSpecs");if(specs)specs.innerHTML=`<div class="list-card" style="margin:6px 0;"><div class="list-row"><strong>⭐ ${rating}</strong><span class="muted">${reviews} sharh</span></div><div class="list-row"><span class="muted">To‘lov</span><span class="muted">Muddatli / Naqd / Payme / Click</span></div></div>`;
const qty=state.cart[p.id]||0;const qel=$("modalQty");if(qel)qel.innerHTML=qty?`<div class="qty"><button data-action="dec" data-id="${p.id}">−</button><span>${qty}</span><button data-action="inc" data-id="${p.id}">+</button></div>`:`<button class="full-btn" data-action="add" data-id="${p.id}">Savatga qo‘shish</button>`;
const add=$("modalAddBtn");if(add){add.dataset.id=String(p.id);add.onclick=()=>addToCart(p.id);} 
const similar=state.products.filter(x=>x.id!==p.id && (x.category===p.category || x.price<=p.price*1.2)).slice(0,4);
const reco=$("modalRecommendations");if(reco)reco.innerHTML=similar.map(card).join('');
$("modalUpsellTitle")&&($("modalUpsellTitle").style.display=similar.length?'block':'none');
ov.classList.add('show');
}
function closeProductModal(){const ov=$("productModalOverlay");ov&&ov.classList.remove('show');}
function renderHome(){const list=filtered();
els.bannerCarousel&&(els.bannerCarousel.innerHTML=`<div class="premium-hero"><div><p class="premium-kicker">Premium market</p><h3>Bugungi xaridlar учун махсус таклифлар</h3><p>${list.length} та реал маҳсулот, тез етказиш ва кафолат.</p><button class="full-btn" id="heroShopNowBtn">Barchasini ko‘rish</button></div><div class="premium-hero-art">✨</div></div>`);
els.homeCategories&&(els.homeCategories.innerHTML=state.categories.slice(0,10).map(c=>`<button class="smart-chip ${state.selectedCategory===c?'active':''}" data-category="${safe(c)}">${c==='all'?'Barchasi':safe(c)}</button>`).join(''));
const deals=state.products.filter(p=>p.oldPrice>p.price).slice(0,6); const popular=[...state.products].sort((a,b)=>(state.cart[b.id]||0)-(state.cart[a.id]||0)||b.price-a.price).slice(0,6); const fresh=[...state.products].slice(-6); const reco=filtered().slice(0,6); const fast=state.products.filter(p=>p.stock>0).slice(0,6);
els.homeDiscountProducts&&(els.homeDiscountProducts.innerHTML=deals.map(card).join(''));
els.homeBestSellerProducts&&(els.homeBestSellerProducts.innerHTML=popular.map(card).join(''));
els.homeFastProducts&&(els.homeFastProducts.innerHTML=fast.map(card).join(''));
els.homeReorderProducts&&(els.homeReorderProducts.innerHTML=fresh.map(card).join(''));
els.homeProducts&&(els.homeProducts.innerHTML=reco.map(card).join(''));
els.promoCarousel&&(els.promoCarousel.innerHTML=`<div class="trust-badges"><div class="trust-badge">🚚 Тез етказиш</div><div class="trust-badge">🛡️ Кафолат</div><div class="trust-badge">💳 Қулай тўлов</div></div>`);
const heroBtn=$('heroShopNowBtn'); heroBtn&&heroBtn.addEventListener('click',()=>openCatalog());}
function renderCategories(){const chips=state.categories.map(c=>`<button class="smart-chip ${state.selectedCategory===c?'active':''}" data-category="${safe(c)}">${c==='all'?'Barchasi':safe(c)}</button>`).join(''); els.categoryResults&&(els.categoryResults.innerHTML=chips);}
function renderProducts(){els.searchResults&&(els.searchResults.innerHTML=filtered().map(card).join(''));}
function renderCart(){const items=Object.entries(state.cart).map(([id,q])=>({p:state.products.find(x=>x.id===+id),q})).filter(x=>x.p);els.cartItems&&(els.cartItems.innerHTML=items.map(({p,q})=>`<div class="list-card cart-item-card"><div class="cart-item-title">${safe(p.name)}</div><div class="cart-item-meta"><strong>${money(p.price*q)}</strong></div><div class="qty"><button data-action="dec" data-id="${p.id}">−</button><span>${q}</span><button data-action="inc" data-id="${p.id}">+</button></div><button class="icon-btn" data-action="remove" data-id="${p.id}">Olib tashlash</button></div>`).join(''));const t=calculateTotals();els.cartEmpty&&(els.cartEmpty.style.display=items.length?'none':'block');els.cartSummary&&(els.cartSummary.style.display=items.length?'block':'none');els.cartSubtotal&&(els.cartSubtotal.textContent=money(t.subtotal));els.cartDelivery&&(els.cartDelivery.textContent=money(t.delivery));els.cartTotalPrice&&(els.cartTotalPrice.textContent=money(t.total));}
function renderCheckout(){const items=Object.entries(state.cart).map(([id,q])=>({p:state.products.find(x=>x.id===+id),q})).filter(x=>x.p);els.checkoutItems&&(els.checkoutItems.innerHTML=items.map(({p,q})=>`<div class="list-card"><div class="list-row"><span>${safe(p.name)} × ${q}</span><strong>${money(p.price*q)}</strong></div></div>`).join(''));const t=calculateTotals();els.checkoutSubtotal&&(els.checkoutSubtotal.textContent=money(t.subtotal));els.checkoutDeliveryPrice&&(els.checkoutDeliveryPrice.textContent=money(t.delivery));els.checkoutGrandTotal&&(els.checkoutGrandTotal.textContent=money(t.total));els.checkoutTotal&&(els.checkoutTotal.textContent=`Jami: ${money(t.total)}`);els.checkoutSavedAddress&&(els.checkoutSavedAddress.textContent=`Saqlangan manzil: ${state.deliveryAddress||'-'}`);els.checkoutAddressLabel&&(els.checkoutAddressLabel.textContent=`Mijoz manzili: ${state.deliveryAddress||'Manzil kiritilmagan'}`)}
function renderProfile(){els.profileName&&(els.profileName.textContent=state.user?.name||'Foydalanuvchi');els.profilePhone&&(els.profilePhone.textContent=`Telefon: ${state.user?.phone||'-'}`);els.profileAddress&&(els.profileAddress.textContent=`Manzil: ${state.deliveryAddress||'Manzil qo‘shilmagan'}`);els.profileOrders&&(els.profileOrders.innerHTML='<p class="muted">Buyurtmalar tarixi тайёрланмоқда</p>')}
function updateBadges(){const q=calculateTotals().qty;els.cartBadge&&(els.cartBadge.textContent=String(q),els.cartBadge.classList.toggle('hidden',q===0));els.homeCartShortcutBadge&&(els.homeCartShortcutBadge.textContent=String(q))}
function renderAll(){renderHome();renderCategories();renderProducts();renderCart();renderCheckout();renderProfile();updateBadges()}
function setView(v){state.currentView=v;views.forEach(id=>{const e=$(id);e&&e.classList.toggle('active',id===v)});document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===v));}
function openCatalog(){state.selectedCategory='all';setView('searchView');renderAll();els.searchInput&&els.searchInput.focus();}
function bind(){
els.openRegisterBtn?.addEventListener('click',()=>els.authSheetOverlay?.classList.add('show'));
els.closeAuthSheetBtn?.addEventListener('click',()=>els.authSheetOverlay?.classList.remove('show'));
els.authSheetOverlay?.addEventListener('click',e=>{if(e.target===els.authSheetOverlay)els.authSheetOverlay.classList.remove('show')});
els.submitAuthBtn?.addEventListener('click',()=>{state.user={name:els.authName?.value?.trim()||'Foydalanuvchi',phone:els.authPhone?.value?.trim()||'-',address:state.deliveryAddress};save();els.phone?.classList.add('show-app');els.authSheetOverlay?.classList.remove('show');renderProfile()});
els.searchInput?.addEventListener('input',e=>{state.searchQuery=e.target.value.trim();renderAll()});
els.searchClearBtn?.addEventListener('click',()=>{state.searchQuery='';if(els.searchInput)els.searchInput.value='';renderAll()});
els.openSearchBtn?.addEventListener('click',openCatalog);
els.homeAllCategoriesLink?.addEventListener('click',e=>{e.preventDefault();openCatalog()});
els.homeMoreProductsLink?.addEventListener('click',e=>{e.preventDefault();openCatalog()});
els.homeCartShortcut?.addEventListener('click',()=>setView('cartView'));
els.cartEmptyCta?.addEventListener('click',openCatalog);
els.orderBtn?.addEventListener('click',()=>setView('checkoutView'));
els.confirmOrderBtn?.addEventListener('click',()=>{if(!calculateTotals().qty)return showToast('Savat bo‘sh');state.cart={};save();renderAll();setView('successView');showToast('Buyurtma qabul qilindi')});
els.backHomeBtn?.addEventListener('click',()=>setView('homeView'));
els.manualAddress?.addEventListener('input',e=>{state.deliveryAddress=e.target.value.trim();if(state.user)state.user.address=state.deliveryAddress;save();renderCheckout();renderProfile()});
els.bottomNav?.addEventListener('click',e=>{const t=e.target.closest('.tab');if(!t)return;setView(t.dataset.view)});
$('closeModalBtn')?.addEventListener('click',closeProductModal);
$('productModalOverlay')?.addEventListener('click',e=>{if(e.target.id==='productModalOverlay')closeProductModal()});

document.addEventListener('click',e=>{const opener=e.target.closest('[data-open-product]');if(opener && !e.target.closest('[data-action]')){openProductModal(opener.dataset.openProduct);return;}const a=e.target.closest('[data-action]');if(a){const id=+a.dataset.id;if(a.dataset.action==='add')addToCart(id);if(a.dataset.action==='inc')increaseQty(id);if(a.dataset.action==='dec')decreaseQty(id);if(a.dataset.action==='remove')removeFromCart(id);if(a.dataset.action==='fav'){state.favorites[id]=!state.favorites[id];save();renderAll();showToast(state.favorites[id]?'Sevimlilarga qo‘shildi':'Sevimlilardan olindi');return;}if(a.dataset.action==='switch-image'){const main=document.querySelector('.modal-main-img');if(main)main.src=a.dataset.src;document.querySelectorAll('.modal-thumb').forEach(t=>t.classList.toggle('active',t===a));return;}if(a.dataset.action==='zoom-image'){const img=document.querySelector('.modal-image');img&&img.classList.toggle('zoomed');return;}}const c=e.target.closest('[data-category]');if(c){state.selectedCategory=c.dataset.category;renderAll();if(state.currentView==='homeView')setView('searchView')}})
}
(async function init(){load();await initData();bind();if(state.user)els.phone?.classList.add('show-app');renderAll();setView('homeView')})();
})();
