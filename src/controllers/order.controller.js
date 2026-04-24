const store = require('../data/store.js');

exports.createOrder = (req, res) => {
  const result = store.createOrder(req.body || {});
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  return res.status(201).json(result.data);
};
