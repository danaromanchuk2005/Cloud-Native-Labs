import { Router } from 'express';
import { validateCreateUser, validateUpdateUser } from '../middleware/validation.js';

export function createApiRouter(controller) {
  const router = Router();

  // Порядок важливий: /users/export реєструємо перед /users/:id
  router.get('/users/export', controller.exportCsv);
  router.get('/users', controller.getAll);
  router.get('/users/:id', controller.getById);
  router.post('/users', validateCreateUser, controller.create);
  router.put('/users/:id', validateUpdateUser, controller.update);
  router.delete('/users/:id', controller.delete);

  // Polyglot persistence: події з MongoDB[cite: 28, 32]
  router.get('/events', controller.getEvents);

  // PostgreSQL ACID-транзакції[cite: 28, 32]
  router.get('/accounts', controller.getAccounts);
  router.post('/accounts/transfer', controller.transferFunds);

  return router;
}