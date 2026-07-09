import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './stats.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/me', asyncHandler(controller.me));
router.get('/manager', asyncHandler(controller.manager));
router.get('/admin', requirePermission('report.read'), asyncHandler(controller.admin));

export default router;
