const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const homeRoutes = require('./src/routes/home.routes.js');

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend.html'));
});

app.use('/api/v1', homeRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
