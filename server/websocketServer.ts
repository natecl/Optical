/**
 * Module: websocketServer
 * 
 * Description:
 *   Initializes and handles the real-time bidirectional communication link
 *   between the Next.js frontend and the Node.js backend. Receives audio and video
 *   chunks from the user's device and pipes them to the respective AI controllers.
 */

import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { AgentController } from "./ai/agentController";

interface WebSocketServerOptions {
  path?: string;
  serviceName?: string;
}

interface InteractPayload {
  frameData?: unknown;
  transcribedText: string;
  convoState?: Record<string, unknown> | null;
}

interface ChatPayload {
  prompt: string;
  history?: Array<{
    role: "user" | "assistant";
    text: string;
  }>;
}

interface IncomingMessagePayload {
  type: string;
  payload?: unknown;
}

const sendMessage = (socket: WebSocket, type: string, payload: unknown) => {
  socket.send(JSON.stringify({ type, payload }));
};

export const startWebSocketServer = (server: Server, options: WebSocketServerOptions = {}) => {
  const wss = new WebSocketServer({ server, path: options.path });
  const serviceName = options.serviceName ?? "optical-ws";

  wss.on("connection", (socket) => {
    const controller = new AgentController();
    console.log("New client connected to Optical WebSocket");
    sendMessage(socket, "connected", { service: serviceName });

    socket.on("message", async (rawMessage) => {
      let message: IncomingMessagePayload;

      try {
        message = JSON.parse(rawMessage.toString()) as IncomingMessagePayload;
      } catch {
        sendMessage(socket, "error", { msg: "Invalid JSON message." });
        return;
      }

      if (message.type === "ping") {
        sendMessage(socket, "pong", { ok: true, ts: Date.now() });
        return;
      }

      if (message.type === "chat") {
        const payload = (message.payload ?? {}) as Partial<ChatPayload>;
        if (!payload.prompt || typeof payload.prompt !== "string") {
          sendMessage(socket, "error", { msg: "payload.prompt is required." });
          return;
        }

        try {
          const result = await controller.processChatPrompt(
            payload.prompt,
            Array.isArray(payload.history) ? payload.history : [],
          );
          sendMessage(socket, "chat_result", result);
        } catch (error) {
          console.error("WebSocket chat error:", error);
          sendMessage(socket, "error", { msg: "Failed to process chat request." });
        }
        return;
      }

      if (message.type !== "interact") {
        sendMessage(socket, "error", {
          msg: "Unsupported message type. Use 'interact', 'chat', or 'ping'.",
        });
        return;
      }

      const payload = (message.payload ?? {}) as Partial<InteractPayload>;
      if (!payload.transcribedText || typeof payload.transcribedText !== "string") {
        sendMessage(socket, "error", { msg: "payload.transcribedText is required." });
        return;
      }

      try {
        const result = await controller.processInteraction(
          payload.frameData ?? null,
          payload.transcribedText,
          payload.convoState ?? null,
        );

        sendMessage(socket, "interaction_result", result);
      } catch (error) {
        console.error("WebSocket interaction error:", error);
        sendMessage(socket, "error", { msg: "Failed to process interaction." });
      }
    });

    socket.on("close", () => {
      console.log("Client disconnected");
    });
  });

  return wss;
};
