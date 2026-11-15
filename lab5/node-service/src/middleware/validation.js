import { BadRequestError } from '../errors/app-error.js';

export function validateIdParam(req, res, next) {
  const rawId = req.params.id;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return next(new BadRequestError('invalid_id', `Invalid identifier "${rawId}". Must be a positive integer`));
  }

  req.parsedId = id;
  next();
}

export function validateBookPayload(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return next(new BadRequestError('invalid_payload', 'Request body must be a JSON object'));
  }

  const { title, author, year } = body;

  if (typeof title !== 'string' || title.trim().length === 0) {
    return next(new BadRequestError('validation_error', 'Field "title" is required and must be a non-empty string'));
  }

  if (typeof author !== 'string' || author.trim().length === 0) {
    return next(new BadRequestError('validation_error', 'Field "author" is required and must be a non-empty string'));
  }

  if (year !== undefined && year !== null) {
    if (typeof year !== 'number' || !Number.isInteger(year) || year < 1000 || year > 2100) {
      return next(new BadRequestError('validation_error', 'Field "year" must be a valid integer between 1000 and 2100'));
    }
  }

  next();
}