const express = require('express');
const path = require('path');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED:', err);
});

const app = express();
const PORT = process.env.PORT || 3000;

const homeRoutes = require('./src/routes/home.routes.js');
const paymeController = require('./src/controllers/payme.controller.js');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files from project root
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '30d',
  immutable: true
}));

// Frontend preview
app.get('/', (req, res) => {
  try {
    return res.sendFile(path.join(__dirname, 'index.html'));
  } catch (e) {
    return res.status(200).json({ ok: true, message: 'Server running' });
  }
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
app.use('/api/v1', homeRoutes);

// Simple health route for hosting platforms
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

console.log('PORT:', process.env.PORT);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
