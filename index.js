const express = require('express');

const app = express();
const PORT = 3000;

const homeRoutes = require('./src/routes/home.routes');

app.use('/api/v1', homeRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});