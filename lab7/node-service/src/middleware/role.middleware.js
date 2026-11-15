import { ForbiddenError } from '../errors/app-error.js';

export function requireRole(requiredRole) {
  return (req, _res, next) => {
    if (!req.user || req.user.role !== requiredRole) {
      return next(new ForbiddenError('forbidden_role', `Access denied: requires role "${requiredRole}"`));
    }
    next();
  };
}