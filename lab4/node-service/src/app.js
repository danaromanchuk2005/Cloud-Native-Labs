import express from 'express';
import { InMemoryBookRepository } from './repositories/book.repository.js';
import { BookService } from './services/book.service.js';
import { BookController } from './controllers/book.controller.js';
import { createBookRouter } from './routes/book.routes.js';
import { requestLogger } from './middleware/logging.js';
import { errorHandler } from './middleware/error-handler.js';
import { NotFoundError } from './errors/app-error.js';

export function createApp({ initialBooks, enableLogging = true } = {}) {
  const app = express();

  const defaultBooks = [
    { id: 1, title: 'Clean Architecture', author: 'Robert C. Martin', year: 2017 },
    { id: 2, title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', year: 2017 }
  ];

  // Dependency Injection: DataStore -> Repository -> Service -> Controller -> Router[cite: 11, 16, 18]
  const bookRepository = new InMemoryBookRepository(initialBooks ?? defaultBooks);
  const bookService = new BookService(bookRepository);
  const bookController = new BookController(bookService);

  if (enableLogging) {
    app.use(requestLogger);
  }
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'node-books-layered-service',
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/books', createBookRouter(bookController));

  app.use((req, _res, next) => {
    next(new NotFoundError('route_not_found', `Route ${req.method} ${req.originalUrl} not found`));
  });

  app.use(errorHandler);

  return app;
}