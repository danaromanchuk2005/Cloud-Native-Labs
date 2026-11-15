import { AppError } from '../errors/app-error.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'invalid_json', message: 'Malformed JSON body' });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.errorCode, message: err.message });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'internal_server_error', message: 'Internal server error' });
}