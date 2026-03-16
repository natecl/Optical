import { WebSocketServer, WebSocket } from 'ws';
import { createLiveSession } from '../services/agent/nanabotService';
import { getSession } from '../services/cookingSessionService';
import {
  generateStepIllustration,
  generateClarifyIllustration,
} from '../services/vision/illustrationService';
import type { Recipe } from '../../types/recipe';
import type { IllustrationResult } from '../../types/illustration';
import type {
  CookingLiveClientMessage,
  CookingLiveServerMessage,
  GeminiLiveMessage,
  ActiveCookingSession,
} from '../../types/websocket';

interface RateLimiter {
  textCount: number;
  binaryCount: number;
  resetTime: number;
}

const TEXT_LIMIT_PER_SEC = 30;
const BINARY_LIMIT_PER_SEC = 60;

const checkRateLimit = (limiter: RateLimiter, isBinary: boolean): boolean => {
  const now = Date.now();
  if (now >= limiter.resetTime) {
    limiter.textCount = 0;
    limiter.binaryCount = 0;
    limiter.resetTime = now + 1000;
  }
  if (isBinary) {
    limiter.binaryCount++;
    return limiter.binaryCount <= BINARY_LIMIT_PER_SEC;
  }
  limiter.textCount++;
  return limiter.textCount <= TEXT_LIMIT_PER_SEC;
};

// Map cookingSessionId -> { geminiSession, clientSocket, currentStepIndex, recipe }
const activeSessions = new Map<string, ActiveCookingSession>();
const STEP_ILLUSTRATION_ERROR = 'Failed to generate illustration';

/**
 * Pre-fetch the next step's illustration in the background (cache-only, no WS message).
 */
const prefetchNextStep = (cookingSessionId: string, currentStepIndex: number, recipe: Recipe): void => {
  const nextIndex = currentStepIndex + 1;
  if (nextIndex >= recipe.instructions.length) return;
  const nextStepText = recipe.instructions[nextIndex];
  const cacheKey = `${cookingSessionId}:${nextIndex}`;
  generateStepIllustration(nextStepText, cacheKey).catch(() => {});
};

const sendJson = (socket: WebSocket, payload: CookingLiveServerMessage): void => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
};

const sendBinary = (socket: WebSocket, data: Buffer): void => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(data);
  }
};

interface StepIllustrationRequest {
  socket: WebSocket;
  cookingSessionId: string;
  stepIndex: number;
  stepText: string;
  recipe: Recipe;
  getEntry: () => ActiveCookingSession | undefined;
  generateIllustration?: typeof generateStepIllustration;
  prefetchIllustration?: typeof prefetchNextStep;
}

const emitStepIllustrationPayload = (
  socket: WebSocket,
  stepText: string,
  result: IllustrationResult
): void => {
  sendJson(socket, {
    type: 'live:illustration',
    context: 'step',
    image: result.data,
    format: result.format,
    alt: stepText,
  });
};

const emitStepIllustrationError = (socket: WebSocket): void => {
  sendJson(socket, {
    type: 'live:illustration_error',
    context: 'step',
    error: STEP_ILLUSTRATION_ERROR,
  });
};

const requestStepIllustration = async ({
  socket,
  cookingSessionId,
  stepIndex,
  stepText,
  recipe,
  getEntry,
  generateIllustration = generateStepIllustration,
  prefetchIllustration = prefetchNextStep,
}: StepIllustrationRequest): Promise<void> => {
  sendJson(socket, { type: 'live:illustration_loading', context: 'step' });

  let result: IllustrationResult | null = null;
  try {
    result = await generateIllustration(stepText, `${cookingSessionId}:${stepIndex}`);
  } catch (err) {
    console.error('[NanaBot] Step illustration error:', (err as Error).message);
  }

  const entry = getEntry();
  if (!entry || entry.currentStepIndex !== stepIndex) {
    return;
  }

  if (result) {
    emitStepIllustrationPayload(socket, stepText, result);
  } else {
    emitStepIllustrationError(socket);
  }

  prefetchIllustration(cookingSessionId, stepIndex, recipe);
};

const handleToolCall = async (entry: ActiveCookingSession, message: GeminiLiveMessage): Promise<void> => {
  const toolCall = message.toolCall;
  if (!toolCall?.functionCalls) return;

  for (const call of toolCall.functionCalls) {
    if (call.name === 'generate_illustration') {
      const description = call.args?.description as string | undefined;
      if (!description) continue;

      console.log('[NanaBot] Tool call: generate_illustration -', description);
      sendJson(entry.clientSocket, { type: 'live:illustration_loading', context: 'clarify' });

      try {
        const result = await generateClarifyIllustration(description);
        if (result) {
          sendJson(entry.clientSocket, {
            type: 'live:illustration',
            context: 'clarify',
            image: result.data,
            format: result.format,
            alt: description,
          });
        } else {
          sendJson(entry.clientSocket, {
            type: 'live:illustration_error',
            context: 'clarify',
            error: 'Failed to generate illustration',
          });
        }
      } catch (err) {
        console.error('[NanaBot] Clarify illustration error:', (err as Error).message);
        sendJson(entry.clientSocket, {
          type: 'live:illustration_error',
          context: 'clarify',
          error: 'Failed to generate illustration',
        });
      }

      // Send tool response back to Gemini so it can continue
      try {
        (entry.geminiSession as any).sendToolResponse({
          functionResponses: [
            {
              id: call.id,
              name: call.name,
              response: { success: true, message: 'Illustration generated and shown to the user.' },
            },
          ],
        });
      } catch (_err) {
        // Ignore if session closed
      }
    }
  }
};

const handleGeminiMessage = (entry: ActiveCookingSession, message: GeminiLiveMessage): void => {
  const clientSocket = entry.clientSocket;
  const serverContent = message.serverContent;

  // Handle tool calls from the model
  if (message.toolCall) {
    handleToolCall(entry, message).catch((err) => {
      console.error('[NanaBot] Unhandled tool call error:', (err as Error).message);
    });
  }

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
          console.log(`[NanaBot] Forwarding audio chunk: ${audioBytes.length} bytes`);
          sendBinary(clientSocket, audioBytes);
        }
      }
    } else if (serverContent.modelTurn) {
      console.log('[NanaBot] modelTurn received but no inlineData parts:', JSON.stringify(serverContent.modelTurn).slice(0, 200));
    }

    // Handle turn completion
    if (serverContent.turnComplete) {
      sendJson(clientSocket, { type: 'live:turn_complete' });
    }
  }
};

const cleanupSession = (cookingSessionId: string): void => {
  const entry = activeSessions.get(cookingSessionId);
  if (entry) {
    try {
      (entry.geminiSession as any).close();
    } catch (_error) {
      // Session may already be closed
    }
    activeSessions.delete(cookingSessionId);
  }
};

export const setupCookingLiveServer = (): WebSocketServer => {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1 * 1024 * 1024 }); // 1MB max

  wss.on('connection', (socket: WebSocket) => {
    let currentCookingSessionId: string | null = null;
    const rateLimiter: RateLimiter = { textCount: 0, binaryCount: 0, resetTime: Date.now() + 1000 };

    socket.on('message', async (rawMessage: Buffer, isBinary: boolean) => {
      if (!checkRateLimit(rateLimiter, isBinary)) {
        if (!isBinary) {
          sendJson(socket, { type: 'live:error', error: 'Rate limit exceeded' });
        }
        return;
      }

      // Binary messages are raw PCM audio from the client mic
      if (isBinary) {
        const entry = activeSessions.get(currentCookingSessionId!);
        if (entry && entry.geminiSession) {
          try {
            const audioData = rawMessage.toString('base64');
            (entry.geminiSession as any).sendRealtimeInput({
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
      let message: CookingLiveClientMessage;
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
                console.log('[NanaBot] Gemini session ready');
                sendJson(socket, { type: 'live:ready' });
              },
              onMessage: (geminiMessage) => {
                const keys = Object.keys(geminiMessage).filter(k => (geminiMessage as Record<string, unknown>)[k] != null);
                console.log('[NanaBot] Gemini message keys:', keys.join(', '));
                const entry = activeSessions.get(cookingSessionId);
                if (entry) {
                  handleGeminiMessage(entry, geminiMessage);
                }
              },
              onError: (error) => {
                console.error('[NanaBot] Gemini error:', error?.message || error);
                sendJson(socket, {
                  type: 'live:error',
                  error: error?.message || 'Gemini Live API error',
                });
              },
              onClose: () => {
                console.log('[NanaBot] Gemini session closed');
                activeSessions.delete(cookingSessionId);
              },
            }
          );

          activeSessions.set(cookingSessionId, {
            geminiSession,
            clientSocket: socket,
            currentStepIndex: cookingSession.currentStepIndex,
            recipe: cookingSession.recipe,
          });

          // Trigger initial greeting and step reading
          try {
            (geminiSession as any).sendClientContent({
              turns: [{
                role: 'user',
                parts: [{ text: 'Hello! Please greet me and read the current step aloud.' }],
              }],
              turnComplete: true,
            });
          } catch (_error) {
            // Ignore if session not ready
          }

          // Generate illustration for the initial step
          const initialStepText =
            cookingSession.recipe.instructions[cookingSession.currentStepIndex];
          if (initialStepText) {
            void requestStepIllustration({
              socket,
              cookingSessionId,
              stepIndex: cookingSession.currentStepIndex,
              stepText: initialStepText,
              recipe: cookingSession.recipe,
              getEntry: () => activeSessions.get(cookingSessionId),
            });
          }
        } catch (error) {
          sendJson(socket, {
            type: 'live:error',
            error: (error as Error)?.message || 'Failed to connect to Gemini Live API',
          });
        }
        return;
      }

      if (type === 'live:video') {
        const entry = activeSessions.get(currentCookingSessionId!);
        if (entry && entry.geminiSession && message.image) {
          try {
            // Strip data URL prefix if present
            const base64Data = message.image.replace(/^data:image\/jpeg;base64,/, '');
            (entry.geminiSession as any).sendRealtimeInput({
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

      if (type === 'live:step_changed') {
        const entry = activeSessions.get(currentCookingSessionId!);
        if (entry && entry.geminiSession) {
          const stepIndex = message.stepIndex;
          if (typeof stepIndex !== 'number') return;

          // Update tracked step index
          entry.currentStepIndex = stepIndex;

          // Interrupt Gemini's current turn by sending an empty client content
          // (sending client content while model is speaking triggers interruption)
          try {
            (entry.geminiSession as any).sendClientContent({
              turns: [{
                role: 'user',
                parts: [{ text: `[STEP CHANGE] Stop what you are saying immediately. The user has moved to Step ${stepIndex + 1}: ${entry.recipe.instructions[stepIndex]}. Please read this new step aloud and guide them.` }],
              }],
              turnComplete: true,
            });
          } catch (_error) {
            // Ignore if session is closed
          }

          // Tell client to flush audio buffer
          sendJson(socket, { type: 'live:interrupted' });

          // Generate illustration for the new step
          const stepText = entry.recipe.instructions[stepIndex];
          if (stepText) {
            void requestStepIllustration({
              socket,
              cookingSessionId: currentCookingSessionId!,
              stepIndex,
              stepText,
              recipe: entry.recipe,
              getEntry: () => activeSessions.get(currentCookingSessionId!),
            });
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

export const __testing = {
  requestStepIllustration,
};
