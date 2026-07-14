import { Router } from 'express';
import { dashboardAuth, optionalAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './issues.controller.js';

const router = Router();

router.get('/', dashboardAuth, asyncHandler(controller.list));

router.use(optionalAuth);
router.post('/', asyncHandler(controller.create));

export default router;
