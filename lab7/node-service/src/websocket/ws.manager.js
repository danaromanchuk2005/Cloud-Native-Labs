import { WebSocketServer, WebSocket } from 'ws';
import { JwtService } from '../auth/jwt.service.js';
import crypto from 'node:crypto';

export class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map();
  }

  attach(httpServer) {
    this.wss = new WebSocketServer({ noServer: true, path: '/ws' });

    httpServer.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      try {
        if (!token) throw new Error('Missing token');
        const payload = JwtService.verifyAccessToken(token);

        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit('connection', ws, req, payload);
        });
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws, _req, user) => {
      const clientId = crypto.randomUUID().slice(0, 8);
      this.clients.set(ws, { clientId, userId: user.sub, role: user.role, connectedAt: new Date().toISOString() });

      ws.send(JSON.stringify({ type: 'connected', clientId, role: user.role }));

      ws.on('close', () => this.clients.delete(ws));
      ws.on('error', () => this.clients.delete(ws));
    });
  }

  broadcast(payload) {
    const serialized = JSON.stringify(payload);
    for (const [ws] of this.clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  }
}