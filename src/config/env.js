const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  dalionApiUrl: process.env.DALION_API_URL || '',
  dalionUsername: process.env.DALION_USERNAME || '',
  dalionPassword: process.env.DALION_PASSWORD || '',
  enableDemoLoaders: String(process.env.ENABLE_DEMO_LOADERS || 'false').toLowerCase() === 'true'
};

module.exports = { env };
