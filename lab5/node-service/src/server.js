import http from 'node:http';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;
const { app, wsManager } = createApp();

const server = http.createServer(app);
wsManager.attach(server);

server.listen(PORT, () => {
  console.log(`Node.js Lab 5 HTTP & WebSocket server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});