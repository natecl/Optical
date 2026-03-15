const { WebSocketServer } = require('ws');
const { createLiveSession } = require('../services/agent/ramseyBotService');
const { getSession } = require('../services/cookingSessionService');

// Map cookingSessionId -> { geminiSession, clientSocket }
const activeSessions = new Map();

const sendJson = (socket, payload) => {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(payload));
  }
};

const sendBinary = (socket, data) => {
  if (socket.readyState === 1) {
    socket.send(data);
  }
};

const handleGeminiMessage = (clientSocket, message) => {
  const serverContent = message.serverContent;

  if (serverContent) {
    // Handle transcription events
    if (serverContent.inputTranscription && serverContent.inputTranscription.text) {
      sendJson(clientSocket, {
        type: 'live:transcript',
        role: 'user',
        text: serverContent.inputTranscription.text,
      });
    }

    if (serverContent.outputTranscription && serverContent.outputTranscription.text) {
      sendJson(clientSocket, {
        type: 'live:transcript',
        role: 'model',
        text: serverContent.outputTranscription.text,
      });
    }

    // Handle audio output
    if (serverContent.modelTurn && serverContent.modelTurn.parts) {
      for (const part of serverContent.modelTurn.parts) {
        if (part.inlineData && part.inlineData.data) {
          const audioBytes = Buffer.from(part.inlineData.data, 'base64');
          sendBinary(clientSocket, audioBytes);
        }
      }
    }

    // Handle turn completion
    if (serverContent.turnComplete) {
      sendJson(clientSocket, { type: 'live:turn_complete' });
    }
  }
};

const cleanupSession = (cookingSessionId) => {
  const entry = activeSessions.get(cookingSessionId);
  if (entry) {
    try {
      entry.geminiSession.close();
    } catch (_error) {
      // Session may already be closed
    }
    activeSessions.delete(cookingSessionId);
  }
};

const setupCookingLiveServer = (server) => {
  const wss = new WebSocketServer({ server, path: '/ws/cooking-live' });

  wss.on('connection', (socket) => {
    let currentCookingSessionId = null;

    socket.on('message', async (rawMessage, isBinary) => {
      // Binary messages are raw PCM audio from the client mic
      if (isBinary) {
        const entry = activeSessions.get(currentCookingSessionId);
        if (entry && entry.geminiSession) {
          try {
            const audioData = rawMessage.toString('base64');
            entry.geminiSession.sendRealtimeInput({
              media: {
                data: audioData,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } catch (_error) {
            // Ignore send errors for audio chunks
          }
        }
        return;
      }

      // Text messages are JSON control messages
      let message;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch (_error) {
        sendJson(socket, { type: 'live:error', error: 'Invalid message format' });
        return;
      }

      const { type } = message;

      if (type === 'live:start') {
        const { cookingSessionId } = message;
        if (!cookingSessionId) {
          sendJson(socket, { type: 'live:error', error: 'cookingSessionId is required' });
          return;
        }

        const cookingSession = getSession(cookingSessionId);
        if (!cookingSession) {
          sendJson(socket, { type: 'live:error', error: 'Cooking session not found' });
          return;
        }

        // Clean up any existing session for this cooking session
        if (currentCookingSessionId) {
          cleanupSession(currentCookingSessionId);
        }

        currentCookingSessionId = cookingSessionId;

        try {
          const geminiSession = await createLiveSession(
            cookingSession.recipe,
            cookingSession.currentStepIndex,
            {
              onReady: () => {
                sendJson(socket, { type: 'live:ready' });
              },
              onMessage: (geminiMessage) => {
                handleGeminiMessage(socket, geminiMessage);
              },
              onError: (error) => {
                sendJson(socket, {
                  type: 'live:error',
                  error: error?.message || 'Gemini Live API error',
                });
              },
              onClose: () => {
                activeSessions.delete(cookingSessionId);
              },
            }
          );

          activeSessions.set(cookingSessionId, {
            geminiSession,
            clientSocket: socket,
          });
        } catch (error) {
          sendJson(socket, {
            type: 'live:error',
            error: error?.message || 'Failed to connect to Gemini Live API',
          });
        }
        return;
      }

      if (type === 'live:video') {
        const entry = activeSessions.get(currentCookingSessionId);
        if (entry && entry.geminiSession && message.image) {
          try {
            // Strip data URL prefix if present
            const base64Data = message.image.replace(/^data:image\/jpeg;base64,/, '');
            entry.geminiSession.sendRealtimeInput({
              media: {
                data: base64Data,
                mimeType: 'image/jpeg',
              },
            });
          } catch (_error) {
            // Ignore send errors for video frames
          }
        }
        return;
      }

      if (type === 'live:stop') {
        if (currentCookingSessionId) {
          cleanupSession(currentCookingSessionId);
          currentCookingSessionId = null;
        }
        return;
      }
    });

    socket.on('close', () => {
      if (currentCookingSessionId) {
        cleanupSession(currentCookingSessionId);
        currentCookingSessionId = null;
      }
    });

    socket.on('error', () => {
      if (currentCookingSessionId) {
        cleanupSession(currentCookingSessionId);
        currentCookingSessionId = null;
      }
    });
  });

  return wss;
};

const notifyStepChange = (cookingSessionId, stepIndex, stepText) => {
  const entry = activeSessions.get(cookingSessionId);
  if (entry && entry.geminiSession) {
    try {
      entry.geminiSession.sendClientContent({
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: `The user has moved to Step ${stepIndex + 1}: ${stepText}. Please read this step aloud and guide them.`,
              },
            ],
          },
        ],
        turnComplete: true,
      });
    } catch (_error) {
      // Ignore if session is closed
    }
  }
};

module.exports = {
  setupCookingLiveServer,
  notifyStepChange,
};
