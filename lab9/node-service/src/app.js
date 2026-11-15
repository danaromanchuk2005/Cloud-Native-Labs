require('./tracing');

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { trace } = require('@opentelemetry/api');
const { WebSocketServer, WebSocket } = require('ws');
const { logger, REPLICA_NAME } = require('./logger');
const { register, metricsMiddleware } = require('./metrics');
const userRepository = require('./repository/userRepository');
const userController = require('./controller/userController');

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(metricsMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  const activeSpan = trace.getActiveSpan();
  const traceId = activeSpan ? activeSpan.spanContext().traceId : '';

  res.setHeader('X-Request-Id', reqId);
  if (traceId) {
    res.setHeader('X-Trace-Id', traceId);
  }

  req.log = logger.child({ reqId, trace_id: traceId });
  req.log.info(
    {
      method: req.method,
      url: req.originalUrl,
      headers: { authorization: req.headers.authorization },
      body: req.body
    },
    'request in'
  );

  res.on('finish', () => {
    const clientIp = req.headers['x-real-ip'] || req.ip;
    req.log.info(
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
        client_ip: clientIp
      },
      'request completed'
    );
  });
  next();
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }
  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_or_expired_token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, path: '/ws' });

function broadcastWs(message) {
  const raw = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(raw);
    }
  }
}

const authController = userController.createAuthController(broadcastWs);

app.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.status(200).send(await register.metrics());
});

app.get('/health', userController.getHealth);
app.get('/api/catalog', userController.getCatalog);
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/users', requireAuth, userController.getUsers);
app.post('/api/users', requireAuth, requireRole('admin'), userController.createUser);
app.get('/api/events', requireAuth, userController.getEvents);

server.on('upgrade', (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    if (!token) throw new Error('missing_token');
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, payload);
    });
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});

wss.on('connection', (ws, _req, user) => {
  ws.send(
    JSON.stringify({
      type: 'connected',
      userId: user.sub,
      role: user.role,
      replica: REPLICA_NAME,
      pid: process.pid
    })
  );
});

userRepository
  .initMongo()
  .catch((err) => logger.warn({ err: err.message }, 'Mongo init warning'))
  .finally(() => {
    server.listen(PORT, () => {
      logger.info({ port: PORT }, 'Node worker listening');
    });
  });

process.on('SIGTERM', () => {
  server.close(async () => {
    await userRepository.closeConnections();
    process.exit(0);
  });
});
