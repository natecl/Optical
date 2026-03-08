This is the Optical Next.js app plus a separate WebSocket service.

## Getting Started

Create env files from `.envexample` before running services:

```bash
cp .envexample .env.local
```

Run the Next.js development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Run the standalone WebSocket service:

```bash
npm run ws:dev
```

Or build/start it in two steps:

```bash
npm run ws:build
npm run ws:start
```

Defaults:
- WS endpoint: `ws://localhost:8080/ws`
- Health endpoint: `http://localhost:8080/health`
- Env overrides: `WS_SERVICE_HOST`, `WS_SERVICE_PORT`

Run the standalone Express backend service:

```bash
npm run backend:dev
```

Or build/start it in two steps:

```bash
npm run backend:build
npm run backend:start
```

Defaults:
- Backend endpoint: `http://localhost:4000`
- Health endpoint: `http://localhost:4000/health`
- Interaction endpoint: `POST http://localhost:4000/api/interact`
- Env overrides: `BACKEND_HOST`, `BACKEND_PORT`

Interaction message format over WebSocket:

```json
{
  "type": "interact",
  "payload": {
    "frameData": null,
    "transcribedText": "Explain what this is",
    "convoState": { "mode": "standard" }
  }
}
```

The frontend also includes a basic chatbot panel (`components/basicchatbot.tsx`) that sends `chat` messages over WebSocket and displays Gemini responses.

Response message format:

```json
{
  "type": "interaction_result",
  "payload": {
    "status": "success",
    "msg": "This is a placeholder Gemini response."
  }
}
```
