const store = require('../data/store.js');

exports.getHome = (req, res) => {
  const mainCategories = store.getCategories({ activeOnly: true });
  const activeProducts = store.listProducts('', { activeOnly: true });

  res.json({
    banners: store.getBanners({ activeOnly: true }),
    promotions: store.getPromotions({ activeOnly: true }),
    home_settings: store.getHomeSettings(),
    main_categories: mainCategories,
    popular_products: activeProducts.slice(0, 3),
    delivery_info: {
      location: 'Yunusobod, Toshkent',
      time: '30 daqiqa',
      price: 12000
    }
  });
};
