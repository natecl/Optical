import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { AgentController } from "../../server/ai/agentController";

interface InteractMessage {
  type: "interact";
  payload: {
    frameData?: unknown;
    transcribedText: string;
    convoState?: Record<string, unknown> | null;
  };
}

interface GenericMessage {
  type: string;
  payload?: unknown;
}

const host = process.env.WS_SERVICE_HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.WS_SERVICE_PORT ?? "8080", 10);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ok", service: "optical-ws", port }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ status: "error", msg: "Not found" }));
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
  const controller = new AgentController();

  socket.send(
    JSON.stringify({
      type: "connected",
      payload: { service: "optical-ws" },
    }),
  );

  socket.on("message", async (data) => {
    let msg: GenericMessage;

    try {
      msg = JSON.parse(data.toString()) as GenericMessage;
    } catch {
      socket.send(JSON.stringify({ type: "error", payload: { msg: "Invalid JSON message." } }));
      return;
    }

    if (msg.type !== "interact") {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { msg: "Unsupported message type. Use { type: 'interact' }." },
        }),
      );
      return;
    }

    const interact = msg as InteractMessage;
    const transcribedText = interact.payload?.transcribedText;

    if (!transcribedText || typeof transcribedText !== "string") {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { msg: "payload.transcribedText is required." },
        }),
      );
      return;
    }

    const result = await controller.processInteraction(
      interact.payload.frameData ?? null,
      transcribedText,
      interact.payload.convoState ?? null,
    );

    socket.send(
      JSON.stringify({
        type: "interaction_result",
        payload: result,
      }),
    );
  });
});

server.listen(port, host, () => {
  console.log(`Optical WS service listening on ws://${host}:${port}/ws`);
  console.log(`Health endpoint available at http://${host}:${port}/health`);
});
