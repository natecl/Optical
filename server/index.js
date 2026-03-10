const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/healthRoutes');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use('/api', healthRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
