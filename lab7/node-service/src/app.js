import express from 'express';
import { config } from './config/env.js';
import { pgPool } from './db/postgres-pool.js';
import { getMongoDb } from './db/mongo-client.js';
import { createUserRepository } from './repositories/user-repository.factory.js';
import { PostgresAccountRepository } from './repositories/account.repository.js';
import { MongoEventLogger } from './events/event-logger.js';
import { WebSocketManager } from './websocket/ws.manager.js';
import { UserService } from './services/user.service.js';
import { UserController } from './controllers/user.controller.js';
import { createApiRouter } from './routes/user.routes.js';
import { requestLogger } from './middleware/logging.js';
import { errorHandler } from './middleware/error-handler.js';
import { NotFoundError } from './errors/app-error.js';

export async function createApp({ repoType = config.repoType, enableLogging = true } = {}) {
  const app = express();
  const wsManager = new WebSocketManager();

  // Підключення до MongoDB потрібне як для REPO_TYPE=mongo, так і для Polyglot EventLogger[cite: 28, 32]
  const mongoDb = await getMongoDb();
  const userRepository = createUserRepository({ repoType, pgPool, mongoDb });
  const accountRepository = new PostgresAccountRepository(pgPool);
  const eventLogger = new MongoEventLogger(mongoDb);

  const userService = new UserService(userRepository, eventLogger, wsManager);
  const userController = new UserController({
    userService,
    userRepository,
    accountRepository,
    eventLogger,
    wsManager
  });

  if (enableLogging) app.use(requestLogger);
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      repoType,
      activeWsClients: wsManager.clients.size
    });
  });

  app.use('/api', createApiRouter(userController));

  app.use((req, _res, next) => {
    next(new NotFoundError('route_not_found', `Route ${req.method} ${req.originalUrl} not found`));
  });

  app.use(errorHandler);

  return { app, wsManager };
}