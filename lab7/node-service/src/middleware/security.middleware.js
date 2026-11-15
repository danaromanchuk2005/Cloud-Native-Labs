export function securityHeaders(_req, res, next) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none';");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

// Захист від NoSQL/SQL ін'єкцій у тілі запиту (санітизація об'єктів з типами $gt тощо)
export function sanitizeInputs(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (key.startsWith('$')) {
        delete req.body[key];
      }
      if (req.body[key] && typeof req.body[key] === 'object') {
        for (const subKey of Object.keys(req.body[key])) {
          if (subKey.startsWith('$')) {
            delete req.body[key][subKey];
          }
        }
      }
    }
  }
  next();
}