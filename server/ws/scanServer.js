const { WebSocketServer } = require('ws');
const { detectIngredientsFromImage } = require('../services/vision/ingredientVisionService');

const MEMORY_WINDOW_MS = 10_000;
const MIN_STABLE_FRAMES = 2;

const createSessionState = () => ({
  detections: new Map(),
  stableIngredients: new Set(),
  processing: false
});

const pruneSession = (session, now) => {
  for (const [ingredient, timestamps] of session.detections.entries()) {
    const recent = timestamps.filter((timestamp) => now - timestamp <= MEMORY_WINDOW_MS);
    if (recent.length === 0) {
      session.detections.delete(ingredient);
      continue;
    }

    session.detections.set(ingredient, recent);
  }
};

const buildStableIngredients = (session, now) => {
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

const recordDetections = (session, ingredients, now) => {
  for (const ingredient of ingredients) {
    const timestamps = session.detections.get(ingredient) || [];
    timestamps.push(now);
    session.detections.set(ingredient, timestamps);
  }
};

const sendJson = (socket, payload) => {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(payload));
  }
};

const setupScanWebSocketServer = (server) => {
  const sessions = new Map();
  const wss = new WebSocketServer({ server, path: '/ws/scan' });

  wss.on('connection', (socket) => {
    const ownedSessionIds = new Set();

    socket.on('message', async (rawMessage) => {
      let message;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch (_error) {
        sendJson(socket, { type: 'scan:error', error: 'Invalid websocket message' });
        return;
      }

      const { type, sessionId } = message || {};
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
          const ingredients = await detectIngredientsFromImage(message.image);
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
          ingredients: Array.isArray(message.ingredients) ? message.ingredients : []
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

module.exports = {
  setupScanWebSocketServer
};
