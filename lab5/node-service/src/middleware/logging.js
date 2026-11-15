export function requestLogger(req, res, next) {
  const start = performance.now();

  res.on('finish', () => {
    const durationMs = Math.round(performance.now() - start);
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
}