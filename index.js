const express = require('express');
const path = require('path');

process.on('uncaughtException', (error) => {
  console.error('[ERROR] uncaughtException', { message: error?.message });
});

process.on('unhandledRejection', (reason) => {
  console.error('[ERROR] unhandledRejection', {
    message: reason instanceof Error ? reason.message : String(reason)
  });
});

const app = express();
const { env } = require('./src/config/env.js');
const PORT = env.port;

const apiRoutes = require('./src/routes/api.routes.js');
const paymeController = require('./src/controllers/payme.controller.js');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map((x) => x.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-phone, x-admin-token');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '30d',
  immutable: true
}));

// Frontend preview
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/orders-display', (req, res) => {
  res.sendFile(path.join(__dirname, 'orders.html'));
});

app.get('/orders', (req, res) => {
  res.redirect('/admin');
});

app.get('/courier/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'courier.html'));
});

app.get('/track/:orderNumber', (req, res) => {
  res.sendFile(path.join(__dirname, 'track.html'));
});

// API routes
app.get('/api/payme', (req, res) => {
  res.status(200).json({ ok: true, message: 'Payme endpoint expects POST JSON-RPC' });
});
app.post('/api/payme', paymeController.paymeRpc);
app.use(env.apiPrefix, apiRoutes);

app.use((err, req, res, next) => {
  console.error('[ERROR] request_failed', { path: req.path, method: req.method, message: err?.message });
  if (res.headersSent) return next(err);
  return res.status(500).json({ ok: false, message: 'Serverda xatolik yuz berdi' });
});

// Simple health route for hosting platforms
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'dalion-mobile-app' });
});

app.listen(PORT, () => {
  console.info(`[SERVER] started on port ${PORT}`);
});
