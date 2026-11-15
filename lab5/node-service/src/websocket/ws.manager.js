import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'node:crypto';

const SOFT_BUFFER_LIMIT = 32 * 1024;  // 32 KB: починаємо пропускати проміжні progress-кадри[cite: 25, 26]
const HARD_BUFFER_LIMIT = 256 * 1024; // 256 KB: розриваємо з'єднання зі стабільно повільним клієнтом[cite: 25, 26]

export class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // ws -> { clientId, username, connectedAt, state, droppedMessages }
  }

  attach(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    this.wss.on('connection', (ws) => {
      const clientId = crypto.randomUUID().slice(0, 8);
      const clientMeta = {
        clientId,
        username: `guest-${clientId}`,
        connectedAt: new Date().toISOString(),
        state: 'CONNECTED',
        droppedMessages: 0
      };

      this.clients.set(ws, clientMeta);
      console.log(`[WS] Client connected: ${clientId}`);

      this.sendSafe(ws, {
        type: 'welcome',
        clientId,
        state: clientMeta.state,
        message: 'Connected to WebSocket server. Send {"type":"auth","username":"YourName"} to identify.'
      });

      ws.on('message', (rawData) => this.handleMessage(ws, rawData));

      ws.on('close', (code, reason) => {
        const meta = this.clients.get(ws);
        if (meta) {
          meta.state = 'CLOSED';
          console.log(`[WS] Client disconnected: ${meta.clientId} (code=${code}, reason=${reason.toString() || 'normal'})`);
          this.clients.delete(ws);
          this.broadcast({
            type: 'system',
            event: 'user_left',
            clientId: meta.clientId,
            username: meta.username
          });
        }
      });

      ws.on('error', (err) => {
        const meta = this.clients.get(ws);
        console.error(`[WS] Socket error (${meta?.clientId}):`, err.message);
        this.clients.delete(ws);
      });
    });
  }

  handleMessage(ws, rawData) {
    const meta = this.clients.get(ws);
    if (!meta) return;

    let msg;
    try {
      msg = JSON.parse(rawData.toString('utf8'));
    } catch {
      this.sendSafe(ws, {
        type: 'error',
        code: 'invalid_json',
        message: 'Message must be valid JSON'
      });
      return;
    }

    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
      this.sendSafe(ws, {
        type: 'error',
        code: 'invalid_schema',
        message: 'Message must contain a string "type" field'
      });
      return;
    }

    // Етап 2 життєвого циклу: Authentication / Identification[cite: 23, 26]
    if (msg.type === 'auth') {
      const cleanName = typeof msg.username === 'string' && msg.username.trim()
        ? msg.username.trim()
        : meta.username;
      meta.username = cleanName;
      meta.state = 'AUTHENTICATED';

      this.sendSafe(ws, {
        type: 'auth_ok',
        clientId: meta.clientId,
        username: meta.username,
        state: meta.state
      });

      this.broadcast({
        type: 'system',
        event: 'user_joined',
        clientId: meta.clientId,
        username: meta.username
      }, ws);
      return;
    }

    // Етап 3 життєвого циклу: Message exchange + broadcast іншим клієнтам[cite: 22, 23, 26]
    if (msg.type === 'message') {
      if (typeof msg.text !== 'string' || !msg.text.trim()) {
        this.sendSafe(ws, {
          type: 'error',
          code: 'empty_message',
          message: 'Field "text" must be a non-empty string'
        });
        return;
      }

      this.broadcast({
        type: 'message',
        from: meta.username,
        clientId: meta.clientId,
        text: msg.text.trim(),
        timestamp: new Date().toISOString()
      }, ws);
      return;
    }

    this.sendSafe(ws, {
      type: 'error',
      code: 'unknown_type',
      message: `Unsupported message type: "${msg.type}"`
    });
  }

  // Надсилання з контролем WebSocket Backpressure (ws.bufferedAmount)[cite: 24, 25, 26]
  sendSafe(ws, payload, { droppable = false } = {}) {
    if (ws.readyState !== WebSocket.OPEN) return false;

    const meta = this.clients.get(ws);
    const buffered = ws.bufferedAmount;

    // 1. Критичне переповнення буфера -> розриваємо з'єднання (Connection termination)[cite: 25, 26]
    if (buffered > HARD_BUFFER_LIMIT) {
      console.warn(`[WS Backpressure] Terminating slow client ${meta?.clientId} (bufferedAmount=${buffered} bytes)`);
      this.clients.delete(ws);
      ws.close(1008, 'Slow consumer: buffer limit exceeded');
      return false;
    }

    // 2. Помірне переповнення буфера -> пропускаємо проміжний кадр прогресу (Message dropping)[cite: 25, 26]
    if (droppable && buffered > SOFT_BUFFER_LIMIT) {
      if (meta) meta.droppedMessages++;
      return false;
    }

    ws.send(JSON.stringify(payload));
    return true;
  }

  broadcast(payload, excludeWs = null, options = {}) {
    for (const [clientWs] of this.clients.entries()) {
      if (clientWs !== excludeWs) {
        this.sendSafe(clientWs, payload, options);
      }
    }
  }

  getActiveClients() {
    const list = [];
    for (const [ws, meta] of this.clients.entries()) {
      list.push({
        ...meta,
        bufferedAmount: ws.bufferedAmount
      });
    }
    return list;
  }
}