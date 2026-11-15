const http = require('http');
const os = require('os');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';
const REPLICA_NAME = process.env.HOSTNAME || os.hostname();

const pgPool = new Pool({
  host: process.env.PG_HOST || 'postgres',
  port: Number(process.env.PG_PORT || 5432),
  database: process.env.PG_DB || 'appdb',
  user: process.env.PG_USER || 'appuser',
  password: process.env.PG_PASSWORD || 'secret'
});

let eventsCollection = null;
async function initMongo() {
  const uri = process.env.MONGO_URI || 'mongodb://appuser:secret@mongo:27017';
  const client = new MongoClient(uri);
  await client.connect();
  eventsCollection = client.db(process.env.MONGO_DB || 'appdb').collection('events');
}

async function logSecurityEvent(type, payload) {
  if (!eventsCollection) return;
  await eventsCollection.insertOne({
    type,
    payload,
    replica: REPLICA_NAME,
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
}

const app = express();
app.set('trust proxy', true);
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const clientIp = req.headers['x-real-ip'] || req.ip;
    console.log(
      `[replica=${REPLICA_NAME} pid=${process.pid}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms | client_ip=${clientIp}`
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

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'node-app',
    replica: REPLICA_NAME,
    pid: process.pid
  });
});

app.get('/api/catalog', (_req, res) => {
  res.status(200).json({
    items: [
      { id: 1, title: 'Cloud Native Architecture', category: 'Books' },
      { id: 2, title: 'Distributed Systems Design', category: 'Books' }
    ],
    servedBy: { replica: REPLICA_NAME, pid: process.pid },
    generatedAt: new Date().toISOString()
  });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password || String(password).length < 8) {
      return res.status(400).json({ error: 'validation_error' });
    }
    const hash = await bcrypt.hash(String(password), 12);
    const { rows } = await pgPool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
      [String(name), String(email), hash, 'user']
    );
    const user = rows[0];
    await logSecurityEvent('user_registered', { id: user.id, email: user.email });
    broadcastWs({ type: 'user_registered', data: { id: user.id, name: user.name }, replica: REPLICA_NAME });
    res.status(201).json({ ...user, servedBy: { replica: REPLICA_NAME, pid: process.pid } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'email_already_exists' });
    }
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const { rows } = await pgPool.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      await logSecurityEvent('login_failed', { email });
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const accessToken = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m', issuer: 'auth-service', algorithms: ['HS256'] }
    );
    const refreshToken = jwt.sign(
      { sub: user.id, role: user.role },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d', issuer: 'auth-service', algorithms: ['HS256'] }
    );
    await logSecurityEvent('user_logged_in', { id: user.id });
    res.status(200).json({
      accessToken,
      refreshToken,
      servedBy: { replica: REPLICA_NAME, pid: process.pid }
    });
  } catch (err) {
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

app.get('/api/users', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pgPool.query('SELECT id, name, email, role, created_at FROM users ORDER BY id ASC');
    res.status(200).json({
      users: rows,
      servedBy: { replica: REPLICA_NAME, pid: process.pid }
    });
  } catch (err) {
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

app.post('/api/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const hash = await bcrypt.hash(String(password || 'Default123!'), 12);
    const { rows } = await pgPool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
      [String(name), String(email), hash, 'user']
    );
    res.status(201).json({ user: rows[0], servedBy: { replica: REPLICA_NAME, pid: process.pid } });
  } catch (err) {
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

app.get('/api/events', requireAuth, async (_req, res) => {
  const events = eventsCollection
    ? await eventsCollection.find().sort({ _id: -1 }).limit(20).toArray()
    : [];
  res.status(200).json({ events, servedBy: { replica: REPLICA_NAME, pid: process.pid } });
});

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

initMongo()
  .catch((err) => console.error('Mongo init warning:', err.message))
  .finally(() => {
    server.listen(PORT, () => {
      console.log(`Worker pid=${process.pid} on replica=${REPLICA_NAME} listening on :${PORT}`);
    });
  });

process.on('SIGTERM', () => {
  server.close(async () => {
    await pgPool.end().catch(() => {});
    process.exit(0);
  });
});
