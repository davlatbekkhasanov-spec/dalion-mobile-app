const store = require('../data/store.js');

exports.getProducts = (req, res) => {
  const { search = '' } = req.query;
  const products = store.listProducts(search);
  res.json({ products });
};
