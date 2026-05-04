const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  dalionBaseUrl: process.env.DALION_BASE_URL || '',
  enableDemoLoaders: String(process.env.ENABLE_DEMO_LOADERS || 'false').toLowerCase() === 'true'
};

module.exports = { env };
