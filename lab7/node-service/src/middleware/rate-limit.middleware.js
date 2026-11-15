import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 хвилина
  max: 5, // Не більше 5 невдалих спроб з однієї IP-адреси
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Too many login attempts, please try again after 1 minute.' }
});