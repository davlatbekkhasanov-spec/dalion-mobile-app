const store = require('../data/store.js');
const { STORE_LOCATION } = require('../constants/domain.constants.js');

exports.getHome = (req, res) => {
  const settings = store.getHomeSettings();
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
    banners: store.getBanners({ activeOnly: true }),
    promotions: store.getPromotions({ activeOnly: true }),
    home_settings: settings,
    settings,
    main_categories: mainCategories,
    categories: mainCategories,
    popular_products: popularProducts,
    popularProducts,
    delivery_info: {
      location: settings.locationText || STORE_LOCATION.address,
      time: settings.deliveryTimeText || '',
      price: 0
    }
  });
};
