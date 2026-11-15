import { JwtService } from '../auth/jwt.service.js';
import { UnauthorizedError } from '../errors/app-error.js';

export function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('missing_token', 'Authorization Bearer token is required'));
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = JwtService.verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch (err) {
    next(err);
  }
}