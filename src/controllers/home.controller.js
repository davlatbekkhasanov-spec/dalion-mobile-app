const store = require('../data/store.js');

exports.getHome = (req, res) => {
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
