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
    popular_products: [
      { id: '1', name: 'Coca Cola 1L', price: 14000, image: '', category_id: 'cat_1' },
      { id: '2', name: 'Pepsi 1L', price: 13000, image: '', category_id: 'cat_1' },
      { id: '3', name: 'Chocolate Bar', price: 9000, image: '', category_id: 'cat_2' }
    ],
    delivery_info: {
      base_km: 3,
      base_price: 12000,
      price_per_km: 2500
    }
  });
};
