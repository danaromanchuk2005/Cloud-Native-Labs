const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  const workers = Number(process.env.WORKERS || Math.min(os.availableParallelism(), 2));
  console.log(`Primary ${process.pid} on ${os.hostname()} starting ${workers} workers`);

  for (let i = 0; i < workers; i++) {
    cluster.fork();
  }

  let shuttingDown = false;

  cluster.on('exit', (worker, code) => {
    if (!shuttingDown) {
      console.log(`Worker ${worker.process.pid} died (${code}) — restarting`);
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
