const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { trace } = require('@opentelemetry/api');
const userRepository = require('../repository/userRepository');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';
const tracer = trace.getTracer('node-api-service');

async function registerUser({ name, email, password, role = 'user' }) {
  return tracer.startActiveSpan('users.create', async (span) => {
    try {
      span.setAttributes({
        'op': 'registerUser',
        'user.role': role
      });
      const hash = await bcrypt.hash(String(password), 10);
      const user = await userRepository.insertUser({
        name: String(name),
        email: String(email),
        passwordHash: hash,
        role
      });
      span.setAttribute('user.id', user.id);
      return user;
    } finally {
      span.end();
    }
  });
}

async function authenticateUser({ email, password }) {
  const user = await userRepository.findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return null;
  }
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '15m', issuer: 'auth-service', algorithm: 'HS256' }
  );
  const refreshToken = jwt.sign(
    { sub: user.id, role: user.role },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d', issuer: 'auth-service', algorithm: 'HS256' }
  );
  return { user, accessToken, refreshToken };
}

async function listUsers() {
  return tracer.startActiveSpan('users.list', async (span) => {
    try {
      span.setAttribute('op', 'listUsers');
      const users = await userRepository.findAllUsers();
      span.setAttribute('users.count', users.length);
      return users;
    } finally {
      span.end();
    }
  });
}

async function listEvents() {
  return userRepository.findRecentEvents(20);
}

module.exports = {
  registerUser,
  authenticateUser,
  listUsers,
  listEvents
};
