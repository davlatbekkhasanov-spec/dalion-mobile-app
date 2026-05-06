function isValidPaymeBasicAuth(headerValue, expectedMerchantId, expectedTestKey) {
  const header = String(headerValue || '');
  if (!header.startsWith('Basic ')) return false;

  const encoded = header.slice(6).trim();
  if (!encoded) return false;

  let decoded = '';
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch (_) {
    return false;
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) return false;

  const login = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  return login === expectedMerchantId && password === expectedTestKey;
}

function paymeAuthMiddleware(req, res, next) {
  const merchantId = String(process.env.PAYME_MERCHANT_ID || '').trim();
  const testKey = String(process.env.PAYME_TEST_KEY || '').trim();

  if (!merchantId || !testKey) {
    return res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32400,
        message: {
          ru: 'Payme sozlamalari topilmadi',
          uz: 'Payme sozlamalari topilmadi',
          en: 'Payme credentials are not configured'
        },
        data: 'configuration'
      },
      id: req.body?.id ?? null
    });
  }

  const authorization = req.header('authorization');
  if (!isValidPaymeBasicAuth(authorization, merchantId, testKey)) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32504,
        message: {
          ru: 'Авторизациядан ўтилмаган',
          uz: 'Avtorizatsiyadan o‘tilmagan',
          en: 'Unauthorized'
        },
        data: 'authorization'
      },
      id: req.body?.id ?? null
    });
  }

  return next();
}

module.exports = {
  paymeAuthMiddleware
};
