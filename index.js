const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const homeRoutes = require('./src/routes/home.routes.js');

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
  res.sendFile(path.join(__dirname, 'index.html'));
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

// API routes
app.use('/api/v1', homeRoutes);

// Simple health route for hosting platforms
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
