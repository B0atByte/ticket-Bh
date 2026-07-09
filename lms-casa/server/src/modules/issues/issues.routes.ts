import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './issues.controller.js';

const router = Router();

router.use(requireAuth);
router.post('/', asyncHandler(controller.create));

export default router;
