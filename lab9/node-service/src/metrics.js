const { monitorEventLoopDelay } = require('perf_hooks');
const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: 'node_'
});

const eventLoopLagGauge = new client.Gauge({
  name: 'node_eventloop_lag_seconds',
  help: 'Mean Node.js event loop lag in seconds',
  registers: [register]
});

const loopMonitor = monitorEventLoopDelay({ resolution: 20 });
loopMonitor.enable();
const lagInterval = setInterval(() => {
  eventLoopLagGauge.set(Math.max(0, loopMonitor.mean / 1e9));
  loopMonitor.reset();
}, 1000);
lagInterval.unref();

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register]
});

function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') {
    return next();
  }
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route && req.route.path ? req.route.path : req.path;
    end({
      method: req.method,
      route,
      status: String(res.statusCode)
    });
  });
  next();
}

module.exports = {
  register,
  metricsMiddleware
};
