"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const websocketServer_1 = require("../../server/websocketServer");
const host = process.env.WS_SERVICE_HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.WS_SERVICE_PORT ?? "8080", 10);
const server = (0, node_http_1.createServer)((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname === "/health") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ status: "ok", service: "optical-ws", port }));
        return;
    }
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "error", msg: "Not found" }));
});
(0, websocketServer_1.startWebSocketServer)(server, { path: "/ws", serviceName: "optical-ws" });
server.listen(port, host, () => {
    console.log(`Optical WS service listening on ws://${host}:${port}/ws`);
    console.log(`Health endpoint available at http://${host}:${port}/health`);
});
