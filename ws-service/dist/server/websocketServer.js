"use strict";
/**
 * Module: websocketServer
 *
 * Description:
 *   Initializes and handles the real-time bidirectional communication link
 *   between the Next.js frontend and the Node.js backend. Receives audio and video
 *   chunks from the user's device and pipes them to the respective AI controllers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebSocketServer = void 0;
const ws_1 = require("ws");
const agentController_1 = require("./ai/agentController");
const sendMessage = (socket, type, payload) => {
    socket.send(JSON.stringify({ type, payload }));
};
const startWebSocketServer = (server, options = {}) => {
    const wss = new ws_1.WebSocketServer({ server, path: options.path });
    const serviceName = options.serviceName ?? "optical-ws";
    wss.on("connection", (socket) => {
        const controller = new agentController_1.AgentController();
        console.log("New client connected to Optical WebSocket");
        sendMessage(socket, "connected", { service: serviceName });
        socket.on("message", async (rawMessage) => {
            let message;
            try {
                message = JSON.parse(rawMessage.toString());
            }
            catch {
                sendMessage(socket, "error", { msg: "Invalid JSON message." });
                return;
            }
            if (message.type === "ping") {
                sendMessage(socket, "pong", { ok: true, ts: Date.now() });
                return;
            }
            if (message.type === "chat") {
                const payload = (message.payload ?? {});
                if (!payload.prompt || typeof payload.prompt !== "string") {
                    sendMessage(socket, "error", { msg: "payload.prompt is required." });
                    return;
                }
                try {
                    const result = await controller.processChatPrompt(payload.prompt, Array.isArray(payload.history) ? payload.history : []);
                    sendMessage(socket, "chat_result", result);
                }
                catch (error) {
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
            const payload = (message.payload ?? {});
            if (!payload.transcribedText || typeof payload.transcribedText !== "string") {
                sendMessage(socket, "error", { msg: "payload.transcribedText is required." });
                return;
            }
            try {
                const result = await controller.processInteraction(payload.frameData ?? null, payload.transcribedText, payload.convoState ?? null);
                sendMessage(socket, "interaction_result", result);
            }
            catch (error) {
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
exports.startWebSocketServer = startWebSocketServer;
