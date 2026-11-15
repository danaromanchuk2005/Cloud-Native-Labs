export class AppError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export class BadRequestError extends AppError {
  constructor(errorCode = 'bad_request', message = 'Invalid request data') {
    super(400, errorCode, message);
  }
}

export class NotFoundError extends AppError {
  constructor(errorCode = 'book_not_found', message = 'Resource not found') {
    super(404, errorCode, message);
  }
}

export class ConflictError extends AppError {
  constructor(errorCode = 'book_already_exists', message = 'Resource already exists') {
    super(409, errorCode, message);
  }
}