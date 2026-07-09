import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './points.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/me', asyncHandler(controller.me));
router.get('/leaderboard', asyncHandler(controller.getLeaderboard));

export default router;
