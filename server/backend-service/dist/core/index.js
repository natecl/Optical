"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const websocketServer_js_1 = require("./websocketServer.js");
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const renderAppDocument = (host) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CookMate Server</title>
  </head>
  <body style="font-family: system-ui, sans-serif; padding: 24px;">
    <h1>CookMate backend server</h1>
    <p>WebSocket endpoint: ws://${host}</p>
    <p>Health check: /health</p>
  </body>
</html>`;
const server = (0, node_http_1.createServer)((req, res) => {
    const host = req.headers.host ?? `localhost:${port}`;
    const url = new URL(req.url ?? '/', `http://${host}`);
    if (url.pathname === '/health') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'ok', service: 'cookmate', port }));
        return;
    }
    if (url.pathname !== '/') {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(renderAppDocument(host));
});
(0, websocketServer_js_1.startWebSocketServer)(server);
server.listen(port, () => {
    console.log(`CookMate server listening on http://localhost:${port}`);
});
