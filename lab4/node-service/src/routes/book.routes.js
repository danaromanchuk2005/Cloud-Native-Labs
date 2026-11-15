import { Router } from 'express';
import { validateBookPayload, validateIdParam } from '../middleware/validation.js';

export function createBookRouter(bookController) {
  const router = Router();

  router.get('/', bookController.getAll);
  router.get('/:id', validateIdParam, bookController.getById);
  router.post('/', validateBookPayload, bookController.create);
  router.put('/:id', validateIdParam, validateBookPayload, bookController.update);
  router.delete('/:id', validateIdParam, bookController.delete);

  return router;
}