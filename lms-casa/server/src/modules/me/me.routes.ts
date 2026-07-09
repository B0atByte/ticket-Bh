import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './me.controller.js';

const router = Router();

router.use(requireAuth, requirePermission('course.read'));

router.get('/course-progress', asyncHandler(controller.courseProgress));
router.get('/data-export', asyncHandler(controller.exportData));
router.delete('/', asyncHandler(controller.anonymize));

export default router;
