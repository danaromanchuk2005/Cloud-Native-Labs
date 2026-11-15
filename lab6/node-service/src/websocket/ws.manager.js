import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'node:crypto';

export class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map();
  }

  attach(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    this.wss.on('connection', (ws) => {
      const clientId = crypto.randomUUID().slice(0, 8);
      this.clients.set(ws, { clientId, connectedAt: new Date().toISOString() });

      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      }));

      ws.on('close', () => this.clients.delete(ws));
      ws.on('error', () => this.clients.delete(ws));
    });
  }

  broadcast(payload) {
    const serialized = JSON.stringify(payload);
    for (const [ws] of this.clients.entries()) {
      if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 256 * 1024) {
        ws.send(serialized);
      }
    }
  }
}