import { WebSocketServer, WebSocket } from 'ws';
import { detectIngredientsFromImage } from '../services/vision/ingredientVisionService';
import type { ScanClientMessage, ScanServerMessage, DetectedIngredient } from '../../types/websocket';

const MEMORY_WINDOW_MS = 10_000;
const MIN_STABLE_FRAMES = 2;

interface ScanSessionState {
  detections: Map<string, number[]>;
  stableIngredients: Set<string>;
  processing: boolean;
}

const createSessionState = (): ScanSessionState => ({
  detections: new Map(),
  stableIngredients: new Set(),
  processing: false
});

const pruneSession = (session: ScanSessionState, now: number): void => {
  for (const [ingredient, timestamps] of session.detections.entries()) {
    const recent = timestamps.filter((timestamp) => now - timestamp <= MEMORY_WINDOW_MS);
    if (recent.length === 0) {
      session.detections.delete(ingredient);
      continue;
    }

    session.detections.set(ingredient, recent);
  }
};

const buildStableIngredients = (session: ScanSessionState, now: number): DetectedIngredient[] => {
  pruneSession(session, now);

  for (const [name, timestamps] of session.detections.entries()) {
    if (timestamps.length >= MIN_STABLE_FRAMES) {
      session.stableIngredients.add(name);
    }
  }

  return [...session.stableIngredients].map((name) => ({
    name,
    confidence: 1
  }));
};

const recordDetections = (session: ScanSessionState, ingredients: string[], now: number): void => {
  for (const ingredient of ingredients) {
    const timestamps = session.detections.get(ingredient) || [];
    timestamps.push(now);
    session.detections.set(ingredient, timestamps);
  }
};

const SCAN_MSG_LIMIT_PER_SEC = 5;

interface ScanRateLimiter {
  count: number;
  resetTime: number;
}

const checkScanRateLimit = (limiter: ScanRateLimiter): boolean => {
  const now = Date.now();
  if (now >= limiter.resetTime) {
    limiter.count = 0;
    limiter.resetTime = now + 1000;
  }
  limiter.count++;
  return limiter.count <= SCAN_MSG_LIMIT_PER_SEC;
};

const sendJson = (socket: WebSocket, payload: ScanServerMessage): void => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
};

export const setupScanWebSocketServer = (): WebSocketServer => {
  const sessions = new Map<string, ScanSessionState>();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 }); // 2MB for images

  wss.on('connection', (socket: WebSocket) => {
    const ownedSessionIds = new Set<string>();
    const rateLimiter: ScanRateLimiter = { count: 0, resetTime: Date.now() + 1000 };

    socket.on('message', async (rawMessage: Buffer) => {
      if (!checkScanRateLimit(rateLimiter)) {
        sendJson(socket, { type: 'scan:error', error: 'Rate limit exceeded' });
        return;
      }

      let message: ScanClientMessage;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch (_error) {
        sendJson(socket, { type: 'scan:error', error: 'Invalid websocket message' });
        return;
      }

      const { type, sessionId } = message as { type: string; sessionId: string };
      if (typeof sessionId !== 'string' || !sessionId.trim()) {
        sendJson(socket, { type: 'scan:error', error: 'sessionId is required' });
        return;
      }

      if (type === 'scan:start') {
        sessions.set(sessionId, createSessionState());
        ownedSessionIds.add(sessionId);
        sendJson(socket, { type: 'scan:started', sessionId });
        return;
      }

      const session = sessions.get(sessionId);
      if (!session) {
        sendJson(socket, { type: 'scan:error', error: 'Unknown scan session', sessionId });
        return;
      }

      if (type === 'scan:frame') {
        if (session.processing) {
          return;
        }

        session.processing = true;
        try {
          const ingredients = await detectIngredientsFromImage((message as { image: string }).image);
          const now = Date.now();
          recordDetections(session, ingredients, now);
          const stableIngredients = buildStableIngredients(session, now);
          sendJson(socket, {
            type: 'scan:update',
            sessionId,
            ingredients: stableIngredients
          });
        } catch (_error) {
          sendJson(socket, { type: 'scan:error', sessionId, error: 'Ingredient detection failed' });
        } finally {
          session.processing = false;
        }
        return;
      }

      if (type === 'scan:stop') {
        const stableIngredients = buildStableIngredients(session, Date.now());
        sendJson(socket, {
          type: 'scan:stopped',
          sessionId,
          ingredients: stableIngredients
        });
        return;
      }

      if (type === 'scan:finalize') {
        sendJson(socket, {
          type: 'scan:finalized',
          sessionId,
          ingredients: Array.isArray((message as { ingredients?: string[] }).ingredients) ? (message as { ingredients: string[] }).ingredients : []
        });
      }
    });

    socket.on('close', () => {
      for (const ownedSessionId of ownedSessionIds) {
        sessions.delete(ownedSessionId);
      }
    });
  });

  return wss;
};
