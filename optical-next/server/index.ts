import { createServer } from 'node:http';
import { startWebSocketServer } from './websocketServer.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

const renderAppDocument = (host: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Optical Server</title>
  </head>
  <body style="font-family: system-ui, sans-serif; padding: 24px;">
    <h1>Optical backend server</h1>
    <p>WebSocket endpoint: ws://${host}</p>
    <p>Health check: /health</p>
  </body>
</html>`;

const server = createServer((req, res) => {
    const host = req.headers.host ?? `localhost:${port}`;
    const url = new URL(req.url ?? '/', `http://${host}`);

    if (url.pathname === '/health') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'ok', service: 'optical', port }));
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

startWebSocketServer(server);

server.listen(port, () => {
    console.log(`Optical server listening on http://localhost:${port}`);
});
