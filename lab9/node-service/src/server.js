const cluster = require('cluster');
const os = require('os');
const { logger } = require('./logger');

if (cluster.isPrimary) {
  const workers = Number(process.env.WORKERS || Math.min(os.availableParallelism(), 2));
  logger.info({ workers, hostname: os.hostname() }, 'Primary starting workers');

  for (let i = 0; i < workers; i++) {
    cluster.fork();
  }

  let shuttingDown = false;

  cluster.on('exit', (worker, code) => {
    if (!shuttingDown) {
      logger.warn({ workerPid: worker.process.pid, code }, 'Worker died, restarting');
      cluster.fork();
    }
  });

  process.on('SIGTERM', () => {
    shuttingDown = true;
    for (const id in cluster.workers) {
      cluster.workers[id].process.kill('SIGTERM');
    }
  });
} else {
  require('./app');
}
