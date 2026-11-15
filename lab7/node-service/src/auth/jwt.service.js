import jwt from 'jsonwebtoken';
import { BadRequestError, UnauthorizedError } from '../errors/app-error.js';

const JWT_SECRET = process.env.JWT_SECRET || 'default_access_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';

export const JwtService = {
  generateAccessToken(user) {
    // Claims: sub, role, iss, iat, exp; заборонено чутливі дані (пароль, хеш)[cite: 35]
    return jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m', issuer: 'auth-service', algorithms: ['HS256'] }
    );
  },

  generateRefreshToken(user) {
    return jwt.sign(
      { sub: user.id, role: user.role },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d', issuer: 'auth-service', algorithms: ['HS256'] }
    );
  },

  verifyAccessToken(token) {
    try {
      // Явний перелік алгоритмів захищає від атаки alg=none[cite: 35, 36]
      return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedError('invalid_or_expired_token', 'Access token is missing, invalid, or expired');
    }
  },

  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedError('invalid_refresh_token', 'Refresh token is invalid or expired');
    }
  }
};