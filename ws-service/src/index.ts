import { createServer } from "node:http";
import { startWebSocketServer } from "../../server/websocketServer";

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

startWebSocketServer(server, { path: "/ws", serviceName: "optical-ws" });

server.listen(port, host, () => {
  console.log(`Optical WS service listening on ws://${host}:${port}/ws`);
  console.log(`Health endpoint available at http://${host}:${port}/health`);
});
