import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from './auth.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { env } from '../../config/env.js';

const router = Router();

const TOO_MANY = {
  error: { code: 'TOO_MANY_LOGIN_ATTEMPTS', message: 'Too many login attempts. Try again in 15 minutes.' },
};

function loginEmail(req: { body?: { email?: unknown } }): string {
  const email = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

// Per (IP + account): stops one IP from spraying many accounts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip ?? 'unknown'}:${loginEmail(req)}`,
  skip: () => env.NODE_ENV === 'development',
  message: TOO_MANY,
});

// Per account (any IP): stops a distributed/botnet brute-force of ONE account
// even when the attacker rotates IPs. Higher cap than the IP limiter to keep the
// lockout-DoS risk low while still bounding credential-stuffing of a single user.
const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `login-account:${loginEmail(req)}`,
  // Only throttle when an email was actually supplied (else all bad-shape
  // requests would share one bucket).
  skip: (req) => env.NODE_ENV === 'development' || loginEmail(req) === '',
  message: TOO_MANY,
});

// Account creation is staff-only (IT / admin). No public self-registration.
// Kept available behind auth so IT/admin can provision accounts via this endpoint too.
router.post('/register', requireAuth, requirePermission('user.create'), asyncHandler(controller.register));
router.post('/login', loginAccountLimiter, loginLimiter, asyncHandler(controller.login));
router.post('/refresh', asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
router.get('/me', requireAuth, asyncHandler(controller.me));

export default router;
