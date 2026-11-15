import { BadRequestError } from '../errors/app-error.js';

export function validateCreateUser(req, _res, next) {
  const { name, email } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return next(new BadRequestError('validation_error', 'Field "name" is required'));
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return next(new BadRequestError('validation_error', 'Valid "email" is required'));
  }
  next();
}

export function validateUpdateUser(req, _res, next) {
  const { name } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return next(new BadRequestError('validation_error', 'Field "name" is required'));
  }
  next();
}