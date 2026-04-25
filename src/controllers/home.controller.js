const store = require('../data/store.js');

exports.getHome = (req, res) => {
  const mainCategories = store.getCategories({ activeOnly: true });
  const activeProducts = store.listProducts('', { activeOnly: true });
  const popularProducts = activeProducts
    .slice()
    .sort((a, b) => {
      const byOrders = Number(b.orderCount || 0) - Number(a.orderCount || 0);
      if (byOrders !== 0) return byOrders;
      const byStock = Number(b.stock || 0) - Number(a.stock || 0);
      if (byStock !== 0) return byStock;
      const byPrice = Number(b.price || 0) - Number(a.price || 0);
      if (byPrice !== 0) return byPrice;
      return String(a.name || '').localeCompare(String(b.name || ''), 'uz');
    })
    .slice(0, 8);

  res.json({
    banners: [
      {
        id: 'banner_1',
        title: 'Tez yetkazib berish',
        subtitle: '30 daqiqa ichida buyurtma bering'
      }
    ],
    main_categories: [
      { id: 'cat_1', name: 'Ichimliklar' },
      { id: 'cat_2', name: 'Shirinliklar' },
      { id: 'cat_3', name: 'Sut mahsulotlari' },
      { id: 'cat_4', name: 'Boshqa' }
    ],
    popular_products: store.listProducts().slice(0, 3),
    delivery_info: {
      location: 'Yunusobod, Toshkent',
      time: '30 daqiqa',
      price: 12000
    }
  });
};
