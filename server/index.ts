import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';

// Load environment variables before importing route/agent modules.
const __dirname = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
const envPaths = [path.resolve(__dirname, '.env'), path.resolve(__dirname, '../.env')];
for (const envPath of envPaths) {
  dotenv.config({ path: envPath, override: false });
}

import healthRoutes from './routes/healthRoutes';
import cookingRoutes from './routes/cookingRoutes';
import { setupScanWebSocketServer } from './ws/scanServer';
import { setupCookingLiveServer } from './ws/cookingLiveServer';

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const server = http.createServer(app);

const isProd = process.env.NODE_ENV === 'production';
const defaultOrigins = ['http://localhost:3000', 'http://localhost:5000'];
const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins;

if (isProd && configuredOrigins.length === 0) {
  throw new Error('CLIENT_URL must be set in production.');
}

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    // Allow same-origin/non-browser requests with no Origin header.
    if (!origin) {
      callback(null, true);
      return;
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
}));
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.json());
app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});
app.use('/api', healthRoutes);
app.use('/api', cookingRoutes);

// Use noServer mode for WebSocket servers to avoid upgrade conflicts
const scanWss = setupScanWebSocketServer();
const cookingWss = setupCookingLiveServer();

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url!, `http://${req.headers.host}`);
  console.log(`[WS Upgrade] ${pathname}`);

  if (pathname === '/ws/scan') {
    scanWss.handleUpgrade(req, socket, head, (ws) => {
      scanWss.emit('connection', ws, req);
    });
  } else if (pathname === '/ws/cooking-live') {
    cookingWss.handleUpgrade(req, socket, head, (ws) => {
      cookingWss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
