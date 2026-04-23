exports.getHome = (req, res) => {
  res.json({
    banners: [],
    main_categories: [
      { id: "cat_1", name: "Ichimliklar" },
      { id: "cat_2", name: "Shirinliklar" }
    ],
    popular_products: [
      {
        id: "1",
        name: "Coca Cola 1L",
        price: 14000,
        image: ""
      }
    ],
    delivery_info: {
      base_km: 3,
      base_price: 12000,
      price_per_km: 2500
    }
  });
};