# Optical AI - System Architecture

This document describes the overall architecture and folder structure of the Optical AI project, showing how the frontend, backend, and Gemini Live API interact in real time.

---

## Repository Structure

optical/
│
├── README.md
├── ARCHITECTURE.md
├── SETUP.md
├── DEPLOYMENT.md
├── DEMO.md
├── AGENT_DESIGN.md
├── API.md
├── CONTRIBUTING.md
│
├── architecture/
│   ├── system-diagram.png
│   ├── data-flow.png
│   └── agent-loop.png
│
├── backend/
│   ├── server.js
│   ├── config.js
│   │
│   ├── routes/
│   │   ├── session.js
│   │   └── health.js
│   │
│   ├── services/
│   │   ├── geminiLive.js
│   │   ├── visionProcessor.js
│   │   └── speechProcessor.js
│   │
│   ├── websocket/
│   │   ├── socketServer.js
│   │   └── streamHandler.js
│   │
│   └── utils/
│       ├── logger.js
│       └── frameEncoder.js
│
├── frontend/
│   ├── pages/
│   │   ├── index.js
│   │   └── api.js
│   │
│   ├── components/
│   │   ├── CameraFeed.jsx
│   │   ├── VoiceInput.jsx
│   │   ├── ExplanationPanel.jsx
│   │   └── LearningQuiz.jsx
│   │
│   ├── hooks/
│   │   ├── useCamera.js
│   │   ├── useMicrophone.js
│   │   └── useWebSocket.js
│   │
│   └── styles/
│       └── globals.css
│
├── scripts/
│   ├── deploy-gcp.sh
│   └── start-local.sh
│
├── demo/
│   ├── demo-video.mp4
│   └── cloud-proof.mp4
│
└── .env.example


---

## Architecture Overview

1. **Frontend (Next.js + React)**  
   - Captures camera and microphone input.
   - Streams frames and audio to the backend in real time.

2. **Backend (Node.js + WebSocket)**  
   - Receives streams from frontend.
   - Forwards multimodal inputs to Gemini Live API.
   - Returns AI explanations as text and speech.

3. **Gemini Live API**  
   - Processes visual and audio inputs.
   - Generates real-time explanations.

4. **Google Cloud Services**  
   - **Cloud Run**: hosts backend API and WebSocket server.
   - **Vertex AI**: powers Gemini Live sessions.
   - **Cloud Logging**: monitors real-time activity.

---

## Diagrams

- `architecture/system-diagram.png` → shows overall system connectivity  
- `architecture/data-flow.png` → shows data flow from camera → AI → voice  
- `architecture/agent-loop.png` → shows agent reasoning loop
