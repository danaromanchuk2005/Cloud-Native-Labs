const userService = require('../service/userService');
const userRepository = require('../repository/userRepository');
const { REPLICA_NAME } = require('../logger');

async function logSecurityEvent(type, payload) {
  await userRepository.insertSecurityEvent({
    type,
    payload,
    replica: REPLICA_NAME,
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
}

function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'node-app',
    replica: REPLICA_NAME,
    pid: process.pid
  });
}

function getCatalog(_req, res) {
  res.status(200).json({
    items: [
      { id: 1, title: 'Cloud Native Architecture', category: 'Books' },
      { id: 2, title: 'Distributed Systems Design', category: 'Books' }
    ],
    servedBy: { replica: REPLICA_NAME, pid: process.pid },
    generatedAt: new Date().toISOString()
  });
}

function createAuthController(broadcastWs) {
  return {
    async register(req, res) {
      try {
        const { name, email, password } = req.body || {};
        if (!name || !email || !password || String(password).length < 8) {
          return res.status(400).json({ error: 'validation_error' });
        }
        const user = await userService.registerUser({ name, email, password, role: 'user' });
        await logSecurityEvent('user_registered', { id: user.id, email: user.email });
        broadcastWs({ type: 'user_registered', data: { id: user.id, name: user.name }, replica: REPLICA_NAME });
        res.status(201).json({ ...user, servedBy: { replica: REPLICA_NAME, pid: process.pid } });
      } catch (err) {
        if (err.code === '23505') {
          return res.status(409).json({ error: 'email_already_exists' });
        }
        req.log.error({ err: err.message }, 'register failed');
        res.status(500).json({ error: 'internal_error' });
      }
    },

    async login(req, res) {
      try {
        const { email, password } = req.body || {};
        if (typeof email !== 'string' || typeof password !== 'string') {
          return res.status(401).json({ error: 'invalid_credentials' });
        }
        const authResult = await userService.authenticateUser({ email, password });
        if (!authResult) {
          await logSecurityEvent('login_failed', { email });
          return res.status(401).json({ error: 'invalid_credentials' });
        }
        await logSecurityEvent('user_logged_in', { id: authResult.user.id });
        res.status(200).json({
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken,
          servedBy: { replica: REPLICA_NAME, pid: process.pid }
        });
      } catch (err) {
        req.log.error({ err: err.message }, 'login failed');
        res.status(500).json({ error: 'internal_error' });
      }
    }
  };
}

async function getUsers(req, res) {
  try {
    const users = await userService.listUsers();
    res.status(200).json({
      users,
      servedBy: { replica: REPLICA_NAME, pid: process.pid }
    });
  } catch (err) {
    req.log.error({ err: err.message }, 'getUsers failed');
    res.status(500).json({ error: 'internal_error' });
  }
}

async function createUser(req, res) {
  try {
    const { name, email, password } = req.body || {};
    const user = await userService.registerUser({
      name,
      email,
      password: password || 'Default123',
      role: 'user'
    });
    res.status(201).json({ user, servedBy: { replica: REPLICA_NAME, pid: process.pid } });
  } catch (err) {
    req.log.error({ err: err.message }, 'createUser failed');
    res.status(500).json({ error: 'internal_error' });
  }
}

async function getEvents(_req, res) {
  const events = await userService.listEvents();
  res.status(200).json({ events, servedBy: { replica: REPLICA_NAME, pid: process.pid } });
}

module.exports = {
  getHealth,
  getCatalog,
  createAuthController,
  getUsers,
  createUser,
  getEvents
};
