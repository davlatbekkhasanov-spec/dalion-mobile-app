const store = require('../data/store.js');

exports.getProducts = (req, res) => {
  const { search = '', category = '' } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
  const all = store.listProducts(search, { activeOnly: true, category });
  const isWholesale = store.isWholesaleTokenValid(req.headers['x-wholesale-token']);
  const start = (page - 1) * limit;
  const items = all.slice(start, start + limit).map((item) => {
    if (!isWholesale) return item;
    const wholesalePrice = Number(item.wholesale_price || item.wholesalePrice || item.price || 0);
    return { ...item, price: wholesalePrice, wholesale_mode: true };
  });
  const hasMore = start + items.length < all.length;
  res.json({
    items,
    page,
    limit,
    total: all.length,
    hasMore,
    products: items
  });
};
