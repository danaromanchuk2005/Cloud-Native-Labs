import { Router } from 'express';

export function createStreamRouter(streamController) {
  const router = Router();

  router.post('/streams/process', streamController.processFile);
  router.get('/ws/clients', streamController.getWsClients);

  return router;
}