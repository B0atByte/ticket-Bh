import { Router } from 'express';
import { optionalAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './issues.controller.js';

const router = Router();

router.use(optionalAuth);
router.post('/', asyncHandler(controller.create));

export default router;
