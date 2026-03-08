/**
 * Module: websocketServer
 * 
 * Description:
 *   Initializes and handles the real-time bidirectional communication link
 *   between the Next.js frontend and the Node.js backend. Receives audio and video
 *   chunks from the user's device and pipes them to the respective AI controllers.
 */

import { WebSocketServer } from 'ws';

export const startWebSocketServer = (server) => {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        console.log('New client connected to Optical WebSocket');

        ws.on('message', (message) => {
            // Boilerplate for routing incoming messages based on type:
            // e.g. 'audio_chunk', 'video_frame', 'user_text'
        });

        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });

    return wss;
};
