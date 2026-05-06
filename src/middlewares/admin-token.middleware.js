function requireAdminImportToken(req, res, next) {
  const configured = process.env.ADMIN_IMPORT_TOKEN;
  if (!configured) {
    return res.status(500).json({
      ok: false,
      message: 'ADMIN_IMPORT_TOKEN is not configured on server'
    });
  }

  const provided = req.headers['x-admin-token'];
  if (!provided || provided !== configured) {
    return res.status(403).json({
      ok: false,
      message: 'Forbidden: invalid or missing admin token'
    });
  }

  return next();
}

module.exports = {
  requireAdminImportToken
};
