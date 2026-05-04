const store = require('../data/store.js');

exports.apply = (req, res) => {
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  if (!name || !phone) return res.status(400).json({ ok: false, message: 'Ism va telefon majburiy' });
  const app = store.createWholesaleApplication({
    name,
    phone,
    businessName: String(req.body?.businessName || '').trim(),
    note: String(req.body?.note || '').trim()
  });
  return res.json({ ok: true, application: app });
};

exports.login = (req, res) => {
  const account = store.wholesaleLogin(req.body?.login, req.body?.password);
  if (!account) return res.status(401).json({ ok: false, message: 'Login yoki parol noto‘g‘ri' });
  return res.json({ ok: true, wholesaleToken: account.id, phone: account.phone, mode: 'wholesale' });
};

exports.listAdmin = (req, res) => res.json({ ok: true, applications: store.listWholesaleApplications() });

exports.decide = (req, res) => {
  const app = store.decideWholesaleApplication(req.params.id, req.body?.decision);
  if (!app) return res.status(404).json({ ok: false, message: 'Ariza topilmadi' });
  return res.json({ ok: true, application: app });
};
