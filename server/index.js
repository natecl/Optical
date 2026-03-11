const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');

// Load environment variables before importing route/agent modules.
const envPaths = [path.resolve(__dirname, '.env'), path.resolve(__dirname, '../.env')];
for (const envPath of envPaths) {
  dotenv.config({ path: envPath, override: false, quiet: true });
}

const healthRoutes = require('./routes/healthRoutes');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use('/api', healthRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
