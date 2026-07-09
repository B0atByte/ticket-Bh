import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const mutationRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.MUTATION_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Skip in development (Decision #17) and skip non-mutation methods.
  skip: (req) => env.NODE_ENV === 'development' || !MUTATION_METHODS.has(req.method),
  message: {
    error: {
      code: 'TOO_MANY_MUTATIONS',
      message: 'Too many write requests. Try again later.',
    },
  },
});
