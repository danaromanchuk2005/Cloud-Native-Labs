import http from 'node:http';
import { config } from './config/env.js';
import { createApp } from './app.js';

const { app, wsManager } = await createApp();
const server = http.createServer(app);
wsManager.attach(server);

server.listen(config.port, () => {
  console.log(`Node.js Lab 6 server running on http://localhost:${config.port} [REPO_TYPE=${config.repoType}]`);
});